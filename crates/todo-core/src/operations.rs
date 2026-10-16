//! Atomic operations over a branch snapshot.

use serde::{Deserialize, Serialize};

use crate::{Status, TodoError, TodoList, init, normalize};

/// Supported model-facing operations.
#[derive(Clone, Copy, Debug, Deserialize, Serialize)]
#[cfg_attr(feature = "wasm", derive(tsify::Tsify))]
#[serde(rename_all = "snake_case")]
pub enum Operation {
    Init,
    Start,
    Done,
    Drop,
    Append,
    View,
}

/// One operation, with task content used as an exact identifier.
#[derive(Clone, Debug, Deserialize, Serialize)]
#[cfg_attr(feature = "wasm", derive(tsify::Tsify))]
#[serde(deny_unknown_fields)]
pub struct Request {
    pub op: Operation,
    pub items: Option<Vec<String>>,
    pub task: Option<String>,
}

/// A successful operation; views never persist a snapshot.
#[derive(Clone, Debug, Serialize, Deserialize)]
#[cfg_attr(feature = "wasm", derive(tsify::Tsify))]
pub struct Change {
    pub list: TodoList,
    pub persist: bool,
}

/// Applies one operation without changing the input on failure.
///
/// # Errors
///
/// Rejects empty or duplicate items and unknown exact-content targets.
pub fn apply(mut list: TodoList, request: Request) -> Result<Change, TodoError> {
    let persist = !matches!(request.op, Operation::View);
    match request.op {
        Operation::Init => list = init(request.items.unwrap_or_default())?,
        Operation::Append => {
            let additions = init(request.items.unwrap_or_default())?;
            for task in &additions.tasks {
                if list
                    .tasks
                    .iter()
                    .any(|existing| existing.content == task.content)
                {
                    return Err(TodoError::DuplicateTask(task.content.clone()));
                }
            }
            list.tasks
                .extend(additions.tasks.into_iter().map(|mut task| {
                    task.status = Status::Pending;
                    task
                }));
        }
        Operation::Start => {
            let target = request.task.ok_or(TodoError::MissingTask)?;
            require_task(&list, &target)?;
            for task in &mut list.tasks {
                if task.content == target {
                    task.status = Status::InProgress;
                } else if task.status == Status::InProgress {
                    task.status = Status::Pending;
                }
            }
        }
        Operation::Done | Operation::Drop => {
            if let Some(target) = &request.task {
                require_task(&list, target)?;
            }
            let status = if matches!(request.op, Operation::Done) {
                Status::Completed
            } else {
                Status::Abandoned
            };
            for task in &mut list.tasks {
                if request
                    .task
                    .as_ref()
                    .is_none_or(|target| task.content == *target)
                {
                    task.status = status;
                }
            }
        }
        Operation::View => {}
    }
    Ok(Change {
        list: if persist { normalize(list) } else { list },
        persist,
    })
}

fn require_task(list: &TodoList, target: &str) -> Result<(), TodoError> {
    if list.tasks.iter().any(|task| task.content == target) {
        Ok(())
    } else {
        Err(TodoError::TaskNotFound(target.to_owned()))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn request(op: Operation, task: Option<&str>, items: &[&str]) -> Request {
        Request {
            op,
            task: task.map(str::to_owned),
            items: Some(items.iter().map(|item| (*item).to_owned()).collect()),
        }
    }

    fn list() -> TodoList {
        init(vec!["a".to_owned(), "b".to_owned()]).unwrap()
    }

    #[test]
    fn start_selects_exact_content_and_can_reopen_closed_work() {
        let closed = apply(list(), request(Operation::Done, None, &[])).unwrap();
        let started = apply(closed.list, request(Operation::Start, Some("b"), &[])).unwrap();
        assert_eq!(
            started.list.tasks[1].status,
            Status::InProgress,
            "reopened target"
        );
        let changed = apply(list(), request(Operation::Start, Some("b"), &[])).unwrap();
        assert_eq!(
            changed.list.tasks[0].status,
            Status::Pending,
            "demote old active"
        );
        assert_eq!(
            changed.list.tasks[1].status,
            Status::InProgress,
            "select target"
        );
        assert!(
            apply(list(), request(Operation::Start, Some(" b "), &[])).is_err(),
            "no trimming identifiers"
        );
        assert!(
            apply(list(), request(Operation::Start, None, &[])).is_err(),
            "start needs target"
        );
    }

    #[test]
    fn closing_normalizes_and_untargeted_closing_affects_all() {
        for op in [Operation::Done, Operation::Drop] {
            let changed = apply(list(), request(op, Some("a"), &[])).unwrap();
            assert_eq!(
                changed.list.tasks[1].status,
                Status::InProgress,
                "next task active"
            );
            let closed = apply(changed.list, request(op, None, &[])).unwrap();
            assert!(
                !closed
                    .list
                    .tasks
                    .iter()
                    .any(|task| task.status == Status::InProgress),
                "all closed"
            );
            assert!(
                apply(list(), request(op, Some("unknown"), &[])).is_err(),
                "missing target fails"
            );
        }
    }

    #[test]
    fn append_is_atomic_and_preserves_active_task() {
        let changed = apply(list(), request(Operation::Append, None, &["c", "d"])).unwrap();
        assert_eq!(changed.list.tasks.len(), 4, "both added");
        assert_eq!(
            changed.list.tasks[0].status,
            Status::InProgress,
            "keep active"
        );
        assert_eq!(
            changed.list.tasks[2].status,
            Status::Pending,
            "append pending"
        );
        for items in [&["c", "a"][..], &["c", "c"], &[" "], &[]] {
            assert!(
                apply(list(), request(Operation::Append, None, items)).is_err(),
                "reject invalid append"
            );
        }
        let closed = apply(list(), request(Operation::Drop, None, &[])).unwrap();
        let added = apply(closed.list, request(Operation::Append, None, &["c"])).unwrap();
        assert_eq!(
            added.list.tasks[2].status,
            Status::InProgress,
            "new first open task"
        );
    }

    #[test]
    fn view_is_read_only() {
        let original = TodoList::default();
        let change = apply(original.clone(), request(Operation::View, None, &[])).unwrap();
        assert_eq!(change.list, original, "same snapshot");
        assert!(!change.persist, "no state entry");
    }
}
