//! Human-facing task groups, separate from the model's complete summary.

use serde::{Deserialize, Serialize};

use crate::{Status, TodoList};

/// Semantic styling for a terminal row.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "wasm", derive(tsify::Tsify))]
#[serde(rename_all = "snake_case")]
pub enum WidgetKind {
    Heading,
    Active,
    Upcoming,
    Done,
    Dropped,
    Summary,
}

/// One row before terminal wrapping and theme application.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "wasm", derive(tsify::Tsify))]
pub struct WidgetRow {
    pub kind: WidgetKind,
    pub text: String,
}

fn group(list: &TodoList, status: Status, expanded: bool, rows: &mut Vec<WidgetRow>) {
    let tasks: Vec<_> = list
        .tasks
        .iter()
        .filter(|task| task.status == status)
        .collect();
    if tasks.is_empty() {
        return;
    }
    let (label, mark, kind) = match status {
        Status::InProgress => ("In progress", "●", WidgetKind::Active),
        Status::Pending => ("Upcoming", "○", WidgetKind::Upcoming),
        Status::Completed => ("Done", "✓", WidgetKind::Done),
        Status::Abandoned => ("Dropped", "−", WidgetKind::Dropped),
    };
    rows.push(WidgetRow {
        kind: WidgetKind::Heading,
        text: format!("{label} · {}", tasks.len()),
    });
    for task in tasks {
        let review = if task.ready_for_review() {
            " · Ready for review"
        } else {
            ""
        };
        rows.push(WidgetRow {
            kind,
            text: format!("{mark} {}{review}", task.content),
        });
        if let Some(unit) = &task.unit {
            rows.push(WidgetRow {
                kind: WidgetKind::Summary,
                text: format!("  {}", unit.summary()),
            });
        }
        rows.extend(
            task.subtasks
                .iter()
                .filter(|child| expanded || child.status == Status::InProgress)
                .map(|child| {
                    let (mark, kind) = match child.status {
                        Status::Pending => ("○", WidgetKind::Upcoming),
                        Status::InProgress => ("●", WidgetKind::Active),
                        Status::Completed => ("✓", WidgetKind::Done),
                        Status::Abandoned => ("−", WidgetKind::Dropped),
                    };
                    WidgetRow {
                        kind,
                        text: child.unit.as_ref().map_or_else(
                            || format!("  {mark} {}", child.content),
                            |unit| format!("  {mark} {} · {}", child.content, unit.summary()),
                        ),
                    }
                }),
        );
    }
}

/// Active tasks by default; all status groups when expanded. Empty lists stay hidden.
#[must_use]
pub fn widget(list: &TodoList, expanded: bool) -> Option<Vec<WidgetRow>> {
    if list.tasks.is_empty() {
        return None;
    }
    let mut rows = Vec::new();
    group(list, Status::InProgress, expanded, &mut rows);
    if rows.is_empty() {
        rows.push(WidgetRow {
            kind: WidgetKind::Summary,
            text: "No task in progress".to_owned(),
        });
    }
    if expanded {
        for status in [Status::Pending, Status::Completed, Status::Abandoned] {
            group(list, status, expanded, &mut rows);
        }
    }
    Some(rows)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::Task;

    fn list() -> TodoList {
        TodoList {
            tasks: [
                ("Earlier work", Status::Completed),
                ("Build the widget", Status::InProgress),
                ("Check the layout", Status::Pending),
                ("Old approach", Status::Abandoned),
                ("Ship the change", Status::Pending),
            ]
            .into_iter()
            .map(|(content, status)| Task {
                content: content.to_owned(),
                status,
                subtasks: vec![],
                unit: None,
            })
            .collect(),
        }
    }

    #[test]
    fn collapsed_shows_only_active_task_text() {
        let list = list();
        let rows = widget(&list, false).unwrap();
        assert_eq!(
            rows,
            vec![
                WidgetRow {
                    kind: WidgetKind::Heading,
                    text: "In progress · 1".to_owned()
                },
                WidgetRow {
                    kind: WidgetKind::Active,
                    text: "● Build the widget".to_owned()
                },
            ]
        );
        assert!(
            crate::view(&list).contains("Earlier work"),
            "model still sees every task"
        );
    }

    #[test]
    fn expanded_groups_tasks_in_order_without_conflating_dropped_and_done() {
        let rows = widget(&list(), true).unwrap();
        let text: Vec<_> = rows.iter().map(|row| row.text.as_str()).collect();
        assert_eq!(
            text,
            [
                "In progress · 1",
                "● Build the widget",
                "Upcoming · 2",
                "○ Check the layout",
                "○ Ship the change",
                "Done · 1",
                "✓ Earlier work",
                "Dropped · 1",
                "− Old approach",
            ]
        );
    }

    #[test]
    fn empty_lists_hide_and_closed_lists_remain_discoverable() {
        assert_eq!(widget(&TodoList::default(), false), None);
        assert_eq!(widget(&TodoList::default(), true), None);
        let list = TodoList {
            tasks: vec![Task {
                content: "Finished".to_owned(),
                status: Status::Completed,
                subtasks: vec![],
                unit: None,
            }],
        };
        assert_eq!(
            widget(&list, false).unwrap(),
            vec![WidgetRow {
                kind: WidgetKind::Summary,
                text: "No task in progress".to_owned(),
            }]
        );
        assert_eq!(widget(&list, true).unwrap().len(), 3);
    }
}
