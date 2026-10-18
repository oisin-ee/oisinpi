//! Atomic operations over a branch snapshot.
use crate::{Status, Subtask, Task, TodoError, TodoList, validate};
use serde::{Deserialize, Serialize};

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

/// Root creation accepts standalone outcomes or outcomes with leaf work units.
#[derive(Clone, Debug, Deserialize, Serialize)]
#[cfg_attr(feature = "wasm", derive(tsify::Tsify))]
#[serde(untagged, deny_unknown_fields)]
pub enum Item {
    Text(String),
    Outcome {
        content: String,
        subtasks: Vec<String>,
    },
}

/// Exact task content, scoped by an optional root parent.
#[derive(Clone, Debug, Deserialize, Serialize)]
#[cfg_attr(feature = "wasm", derive(tsify::Tsify))]
#[serde(deny_unknown_fields)]
pub struct Request {
    pub op: Operation,
    pub items: Option<Vec<Item>>,
    pub task: Option<String>,
    pub parent: Option<String>,
}

/// A successful operation; views never persist a snapshot.
#[derive(Clone, Debug, Serialize, Deserialize)]
#[cfg_attr(feature = "wasm", derive(tsify::Tsify))]
pub struct Change {
    pub list: TodoList,
    pub persist: bool,
}

pub(crate) fn create(items: Vec<Item>) -> Result<TodoList, TodoError> {
    if items.is_empty() {
        return Err(TodoError::MissingItems);
    }
    let tasks = items
        .into_iter()
        .map(|item| {
            let (content, children) = match item {
                Item::Text(content) => (content, vec![]),
                Item::Outcome { content, subtasks } => (content, subtasks),
            };
            Task {
                content: content.trim().to_owned(),
                status: Status::Pending,
                subtasks: children
                    .into_iter()
                    .map(|content| Subtask {
                        content: content.trim().to_owned(),
                        status: Status::Pending,
                    })
                    .collect(),
            }
        })
        .collect();
    let list = TodoList { tasks };
    validate(&list)?;
    Ok(list)
}

const fn arguments(request: &Request) -> Result<(), TodoError> {
    let invalid = match request.op {
        Operation::Init => request.parent.is_some() || request.task.is_some(),
        Operation::Append => request.task.is_some(),
        Operation::Start => request.items.is_some() || request.task.is_none(),
        Operation::Done | Operation::Drop => {
            request.items.is_some() || (request.parent.is_some() && request.task.is_none())
        }
        Operation::View => {
            request.items.is_some() || request.task.is_some() || request.parent.is_some()
        }
    };
    if invalid {
        Err(TodoError::InvalidRequest)
    } else {
        Ok(())
    }
}

fn root<'a>(list: &'a mut TodoList, content: &str) -> Result<&'a mut Task, TodoError> {
    list.tasks
        .iter_mut()
        .find(|task| task.content == content)
        .ok_or_else(|| TodoError::TaskNotFound(content.to_owned()))
}

fn append(list: &mut TodoList, request: Request) -> Result<(), TodoError> {
    let items = request.items.unwrap_or_default();
    if let Some(parent) = request.parent {
        if items.iter().any(|item| !matches!(item, Item::Text(_))) {
            return Err(TodoError::InvalidRequest);
        }
        let additions = create(items)?;
        let target = root(list, &parent)?;
        target
            .subtasks
            .extend(additions.tasks.into_iter().map(|task| Subtask {
                content: task.content,
                status: task.status,
            }));
        if !target.status.is_open() {
            target.status = Status::Pending;
        }
    } else {
        list.tasks.extend(create(items)?.tasks);
    }
    validate(list)
}

fn close(task: &mut Task, status: Status) -> Result<(), TodoError> {
    if status == Status::Completed && task.subtasks.iter().any(|child| child.status.is_open()) {
        return Err(TodoError::OpenChildren(task.content.clone()));
    }
    if status == Status::Abandoned {
        for child in &mut task.subtasks {
            if child.status.is_open() {
                child.status = status;
            }
        }
    }
    task.status = status;
    Ok(())
}

fn target(list: &mut TodoList, request: &Request, status: Status) -> Result<(), TodoError> {
    let content = request.task.as_ref().ok_or(TodoError::MissingTask)?;
    if let Some(parent) = &request.parent {
        let task = root(list, parent)?;
        let child = task
            .subtasks
            .iter_mut()
            .find(|child| child.content == *content)
            .ok_or_else(|| TodoError::TaskNotFound(content.clone()))?;
        child.status = status;
        if status == Status::InProgress {
            task.status = Status::InProgress;
        }
    } else {
        let task = root(list, content)?;
        if status == Status::InProgress {
            task.status = status;
        } else {
            close(task, status)?;
        }
    }
    Ok(())
}

/// Applies a validated operation without changing its input on failure.
///
/// # Errors
/// Rejects malformed requests, duplicate siblings, unknown targets and premature parent completion.
pub fn apply(mut list: TodoList, request: Request) -> Result<Change, TodoError> {
    validate(&list)?;
    arguments(&request)?;
    let persist = !matches!(request.op, Operation::View);
    match request.op {
        Operation::Init => list = create(request.items.unwrap_or_default())?,
        Operation::Append => append(&mut list, request)?,
        Operation::View => {}
        Operation::Start => target(&mut list, &request, Status::InProgress)?,
        Operation::Done | Operation::Drop => {
            let status = if matches!(request.op, Operation::Done) {
                Status::Completed
            } else {
                Status::Abandoned
            };
            if request.task.is_some() {
                target(&mut list, &request, status)?;
            } else {
                for task in list.tasks.iter_mut().filter(|task| task.status.is_open()) {
                    close(task, status)?;
                }
            }
        }
    }
    Ok(Change { list, persist })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn request(
        op: Operation,
        parent: Option<&str>,
        task: Option<&str>,
        items: Option<Vec<Item>>,
    ) -> Request {
        Request {
            op,
            parent: parent.map(str::to_owned),
            task: task.map(str::to_owned),
            items,
        }
    }
    fn list() -> TodoList {
        create(vec![
            Item::Outcome {
                content: "Outcome".to_owned(),
                subtasks: vec!["Build".to_owned(), "Verify".to_owned()],
            },
            Item::Text("Other".to_owned()),
        ])
        .unwrap()
    }
    fn run(list: TodoList, request: Request) -> TodoList {
        apply(list, request).unwrap().list
    }

    #[test]
    fn explicit_starts_preserve_parallel_work_and_require_parent_review() {
        let list = run(
            list(),
            request(Operation::Start, Some("Outcome"), Some("Build"), None),
        );
        let list = run(
            list,
            request(Operation::Start, Some("Outcome"), Some("Verify"), None),
        );
        assert!(
            list.tasks[0]
                .subtasks
                .iter()
                .all(|child| child.status == Status::InProgress),
            "parallel starts"
        );
        assert!(
            apply(
                list.clone(),
                request(Operation::Done, None, Some("Outcome"), None)
            )
            .is_err(),
            "parent blocked"
        );
        assert!(
            apply(list.clone(), request(Operation::Done, None, None, None)).is_err(),
            "bulk completion blocked"
        );
        let list = run(
            list,
            request(Operation::Done, Some("Outcome"), Some("Build"), None),
        );
        let list = run(
            list,
            request(Operation::Drop, Some("Outcome"), Some("Verify"), None),
        );
        assert!(
            list.tasks[0].ready_for_review(),
            "explicit integration review remains"
        );
        assert!(
            crate::view(&list).contains("1/2 subtasks completed"),
            "abandoned not completed"
        );
        let list = run(list, request(Operation::Done, None, Some("Outcome"), None));
        assert_eq!(
            list.tasks[0].status,
            Status::Completed,
            "explicit completion"
        );
        assert_eq!(
            list.tasks[1].status,
            Status::Pending,
            "no automatic activation"
        );
    }

    #[test]
    fn drop_preserves_completed_children_and_append_reopens_parent() {
        let list = run(
            list(),
            request(Operation::Done, Some("Outcome"), Some("Build"), None),
        );
        let list = run(list, request(Operation::Drop, None, Some("Outcome"), None));
        assert_eq!(
            list.tasks[0].subtasks[0].status,
            Status::Completed,
            "completed preserved"
        );
        assert_eq!(
            list.tasks[0].subtasks[1].status,
            Status::Abandoned,
            "open abandoned"
        );
        let list = run(
            list,
            request(
                Operation::Append,
                Some("Outcome"),
                None,
                Some(vec![Item::Text("Integrate".to_owned())]),
            ),
        );
        assert_eq!(
            list.tasks[0].status,
            Status::Pending,
            "closed parent reopens pending"
        );
        let list = run(
            list,
            request(Operation::Start, Some("Outcome"), Some("Build"), None),
        );
        assert_eq!(
            list.tasks[0].status,
            Status::InProgress,
            "child start opens parent"
        );
    }

    #[test]
    fn exact_scoping_and_atomic_rejections() {
        for value in [
            request(
                Operation::Append,
                Some("Outcome"),
                None,
                Some(vec![
                    Item::Text("New".to_owned()),
                    Item::Text("Build".to_owned()),
                ]),
            ),
            request(
                Operation::Append,
                Some("missing"),
                None,
                Some(vec![Item::Text("New".to_owned())]),
            ),
            request(
                Operation::Append,
                Some("Outcome"),
                None,
                Some(vec![Item::Outcome {
                    content: "Nested".to_owned(),
                    subtasks: vec![],
                }]),
            ),
            request(Operation::Start, None, Some("Build"), None),
            request(Operation::Start, Some("Outcome"), Some(" Build "), None),
            request(Operation::Done, Some("Outcome"), None, None),
        ] {
            let original = list();
            assert!(
                apply(original.clone(), value).is_err(),
                "reject without input mutation"
            );
            assert_eq!(original, list(), "unchanged snapshot");
        }
        let list = run(
            list(),
            request(
                Operation::Append,
                None,
                None,
                Some(vec![Item::Outcome {
                    content: "Another".to_owned(),
                    subtasks: vec!["Build".to_owned()],
                }]),
            ),
        );
        assert_eq!(
            list.tasks.len(),
            3,
            "same child label in different parents accepted"
        );
    }

    #[test]
    fn bulk_closure_changes_open_work_only() {
        let list = run(list(), request(Operation::Done, None, Some("Other"), None));
        let list = run(list, request(Operation::Drop, None, None, None));
        assert_eq!(
            list.tasks[1].status,
            Status::Completed,
            "closed outcome preserved"
        );
        assert!(
            list.tasks[0]
                .subtasks
                .iter()
                .all(|child| child.status == Status::Abandoned),
            "open children abandoned"
        );
    }
}
