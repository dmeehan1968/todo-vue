/*
 * Generated type guards for "app.ts".
 * WARNING: Do not manually change this file.
 */
import { DraftTodo } from "./app";

export function isDraftTodo(obj: unknown): obj is DraftTodo {
    const typedObj = obj as DraftTodo
    return (
        (typedObj !== null &&
            typeof typedObj === "object" ||
            typeof typedObj === "function") &&
        typeof typedObj["name"] === "string" &&
        typeof typedObj["completed"] === "boolean"
    )
}
