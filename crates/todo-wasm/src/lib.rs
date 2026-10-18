//! wasm-bindgen bindings of `todo-core`. Each export maps one tool operation;
//! a rejected operation throws a JavaScript `Error` with the core's message.
//!
//! Values cross the boundary as `tsify::Ts`, so a malformed value from
//! JavaScript fails as an ordinary `Result` inside the function and leaks
//! nothing (tsify README, "Why are the `wasm_abi` attributes deprecated").

use todo_core::{Change, ReminderHistory, Request, TodoList, WidgetRow};
use tsify::{Ts, Tsify};
use wasm_bindgen::JsValue;
use wasm_bindgen::prelude::{JsError, wasm_bindgen};

/// Replaces the whole list with `items`.
///
/// # Errors
///
/// Throws the core's message for an empty list, an empty task, or a repeat.
#[wasm_bindgen]
pub fn init(items: Vec<String>) -> Result<Ts<TodoList>, JsError> {
    let list = todo_core::init(items)?;
    Ok(list.into_ts()?)
}

/// Validates a stored snapshot. It comes from the session file, so it is typed
/// `unknown` and checked here, by the type that owns its shape.
///
/// # Errors
///
/// Throws when `snapshot` is not a valid todo list.
#[wasm_bindgen]
pub fn parse(
    #[wasm_bindgen(unchecked_param_type = "unknown")] snapshot: JsValue,
) -> Result<Ts<TodoList>, JsError> {
    let list: TodoList = Ts::<TodoList>::new_unchecked(snapshot).to_rust()?;
    todo_core::validate(&list)?;
    Ok(list.into_ts()?)
}

/// Applies one validated operation.
///
/// # Errors
///
/// Throws for malformed input or a rejected operation.
#[wasm_bindgen]
pub fn apply(list: &Ts<TodoList>, request: &Ts<Request>) -> Result<Ts<Change>, JsError> {
    Ok(todo_core::apply(list.to_rust()?, request.to_rust()?)?.into_ts()?)
}

/// Computes completion policy from branch facts.
///
/// # Errors
///
/// Throws for malformed facts.
#[wasm_bindgen]
pub fn completion_reminder(facts: &Ts<ReminderHistory>) -> Result<Option<String>, JsError> {
    Ok(todo_core::completion_reminder(&facts.to_rust()?.facts))
}

/// The model-facing summary of `list`.
///
/// # Errors
///
/// Throws when `list` is not a valid todo list.
#[wasm_bindgen]
pub fn view(list: &Ts<TodoList>) -> Result<String, JsError> {
    Ok(todo_core::view(&list.to_rust()?))
}

/// Human-facing rows for `list`, or `undefined` for an empty list.
///
/// # Errors
///
/// Throws when `list` is not a valid todo list.
#[wasm_bindgen]
pub fn widget(list: &Ts<TodoList>, expanded: bool) -> Result<Option<Vec<Ts<WidgetRow>>>, JsError> {
    todo_core::widget(&list.to_rust()?, expanded)
        .map(|rows| {
            rows.into_iter()
                .map(|row| row.into_ts().map_err(JsError::from))
                .collect()
        })
        .transpose()
}
