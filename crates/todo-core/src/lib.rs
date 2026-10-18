//! Todo list state and operations for the pi todo tool.
//!
//! The model follows oh-my-pi's `todo` tool (`docs/tools/todo.md`): tasks are
//! addressed by their exact content, and after each change the first open task
//! becomes the one active task.

mod operations;
mod reminder;
mod widget;

pub use widget::{WidgetKind, WidgetRow, widget};

pub use operations::{Change, Operation, Request, apply};
pub use reminder::{ReminderFact, ReminderHistory, completion_reminder};

use std::fmt;

use serde::{Deserialize, Serialize};

/// The state of one task.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "wasm", derive(tsify::Tsify))]
#[serde(rename_all = "snake_case")]
pub enum Status {
    Pending,
    InProgress,
    Completed,
    Abandoned,
}

/// One task, addressed by its exact content.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "wasm", derive(tsify::Tsify))]
#[serde(deny_unknown_fields)]
pub struct Task {
    pub content: String,
    pub status: Status,
}

/// The whole todo list of a session branch.
#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "wasm", derive(tsify::Tsify))]
#[serde(deny_unknown_fields)]
pub struct TodoList {
    pub tasks: Vec<Task>,
}

/// A rejected operation. The list stays as it was before the call.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum TodoError {
    MissingItems,
    EmptyTask,
    DuplicateTask(String),
    MissingTask,
    TaskNotFound(String),
}

impl fmt::Display for TodoError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::MissingItems => f.write_str("Missing items for init operation"),
            Self::EmptyTask => f.write_str("Missing task content"),
            Self::DuplicateTask(content) => write!(f, "Duplicate task \"{content}\" in list"),
            Self::MissingTask => f.write_str("Missing task content for start operation"),
            Self::TaskNotFound(content) => {
                write!(f, "Task \"{content}\" not found; use exact task content")
            }
        }
    }
}

impl std::error::Error for TodoError {}

/// Replaces the whole list with `items`, all pending before normalization.
///
/// # Errors
///
/// Rejects an empty list, an empty task, and a repeated task.
pub fn init(items: Vec<String>) -> Result<TodoList, TodoError> {
    if items.is_empty() {
        return Err(TodoError::MissingItems);
    }
    let mut tasks: Vec<Task> = Vec::with_capacity(items.len());
    for item in items {
        let content = item.trim();
        if content.is_empty() {
            return Err(TodoError::EmptyTask);
        }
        if tasks.iter().any(|task| task.content == content) {
            return Err(TodoError::DuplicateTask(content.to_owned()));
        }
        tasks.push(Task {
            content: content.to_owned(),
            status: Status::Pending,
        });
    }
    Ok(normalize(TodoList { tasks }))
}

/// Keeps exactly one active task: the first `in_progress` one, or else the
/// first pending one (omp `normalizeInProgressTask`).
#[must_use]
pub fn normalize(mut list: TodoList) -> TodoList {
    let active = list
        .tasks
        .iter()
        .position(|task| task.status == Status::InProgress)
        .or_else(|| {
            list.tasks
                .iter()
                .position(|task| task.status == Status::Pending)
        });
    for (index, task) in list.tasks.iter_mut().enumerate() {
        if Some(index) == active {
            task.status = Status::InProgress;
        } else if task.status == Status::InProgress {
            task.status = Status::Pending;
        }
    }
    list
}

/// The model-facing summary of the list.
#[must_use]
pub fn view(list: &TodoList) -> String {
    if list.tasks.is_empty() {
        return "Todo list is empty.".to_owned();
    }
    let done = list
        .tasks
        .iter()
        .filter(|task| task.status == Status::Completed)
        .count();
    let header = format!("Todo list: {done}/{} completed", list.tasks.len());
    let lines = list.tasks.iter().map(|task| {
        let mark = match task.status {
            Status::Pending => "[ ]",
            Status::InProgress => "[/]",
            Status::Completed => "[x]",
            Status::Abandoned => "[-]",
        };
        format!("{mark} {}", task.content)
    });
    std::iter::once(header)
        .chain(lines)
        .collect::<Vec<_>>()
        .join("\n")
}

#[cfg(test)]
mod tests {
    use super::*;

    fn items(values: &[&str]) -> Vec<String> {
        values.iter().map(|value| (*value).to_owned()).collect()
    }

    #[test]
    fn init_makes_the_first_task_active() {
        let list = init(items(&["Read the code", " Write the fix "])).unwrap();
        assert_eq!(
            list.tasks,
            vec![
                Task {
                    content: "Read the code".to_owned(),
                    status: Status::InProgress,
                },
                Task {
                    content: "Write the fix".to_owned(),
                    status: Status::Pending,
                },
            ],
            "trimmed tasks, first one active",
        );
    }

    #[test]
    fn init_rejects_bad_lists() {
        assert_eq!(init(Vec::new()), Err(TodoError::MissingItems), "empty list");
        assert_eq!(
            init(items(&["a", "  "])),
            Err(TodoError::EmptyTask),
            "blank task"
        );
        assert_eq!(
            init(items(&["a", "a "])),
            Err(TodoError::DuplicateTask("a".to_owned())),
            "duplicate after trimming",
        );
    }

    #[test]
    fn normalize_keeps_one_active_task() {
        let list = normalize(TodoList {
            tasks: vec![
                Task {
                    content: "a".to_owned(),
                    status: Status::Completed,
                },
                Task {
                    content: "b".to_owned(),
                    status: Status::InProgress,
                },
                Task {
                    content: "c".to_owned(),
                    status: Status::InProgress,
                },
            ],
        });
        let statuses: Vec<Status> = list.tasks.iter().map(|task| task.status).collect();
        assert_eq!(
            statuses,
            vec![Status::Completed, Status::InProgress, Status::Pending],
            "only the first in-progress task stays active",
        );
    }

    #[test]
    fn view_lists_every_task() {
        assert_eq!(
            view(&TodoList::default()),
            "Todo list is empty.",
            "empty list"
        );
        let list = init(items(&["a", "b"])).unwrap();
        assert_eq!(
            view(&list),
            "Todo list: 0/2 completed\n[/] a\n[ ] b",
            "header and marks"
        );
    }
}
