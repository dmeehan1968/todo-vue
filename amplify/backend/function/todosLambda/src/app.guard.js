"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isDraftTodo = void 0;
function isDraftTodo(obj) {
    const typedObj = obj;
    return ((typedObj !== null &&
        typeof typedObj === "object" ||
        typeof typedObj === "function") &&
        typeof typedObj["name"] === "string" &&
        typeof typedObj["completed"] === "boolean");
}
exports.isDraftTodo = isDraftTodo;
