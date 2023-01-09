/*
 * Generated type guards for "app.ts".
 * WARNING: Do not manually change this file.
 */
import { TodoCommon, TodoStore, TodoModel } from "./app";

export function isTodoCommon(obj: unknown): obj is TodoCommon {
    const typedObj = obj as TodoCommon
    return (
        (typedObj !== null &&
            typeof typedObj === "object" ||
            typeof typedObj === "function") &&
        typeof typedObj["name"] === "string" &&
        typeof typedObj["completed"] === "boolean"
    )
}

export function isTodoStore(obj: unknown): obj is TodoStore {
    const typedObj = obj as TodoStore
    return (
        isTodoCommon(typedObj) as boolean &&
        typeof typedObj["PK"] === "string" &&
        typeof typedObj["SK"] === "string"
    )
}

export function isTodoModel(obj: unknown): obj is TodoModel {
    const typedObj = obj as TodoModel
    return (
        isTodoCommon(typedObj) as boolean &&
        typeof typedObj["id"] === "string"
    )
}
