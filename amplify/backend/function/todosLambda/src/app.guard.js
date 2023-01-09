"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isTodoModel = exports.isTodoStore = exports.isTodoCommon = void 0;
function isTodoCommon(obj) {
    const typedObj = obj;
    return ((typedObj !== null &&
        typeof typedObj === "object" ||
        typeof typedObj === "function") &&
        typeof typedObj["name"] === "string" &&
        typeof typedObj["completed"] === "boolean");
}
exports.isTodoCommon = isTodoCommon;
function isTodoStore(obj) {
    const typedObj = obj;
    return (isTodoCommon(typedObj) &&
        typeof typedObj["PK"] === "string" &&
        typeof typedObj["SK"] === "string");
}
exports.isTodoStore = isTodoStore;
function isTodoModel(obj) {
    const typedObj = obj;
    return (isTodoCommon(typedObj) &&
        typeof typedObj["id"] === "string");
}
exports.isTodoModel = isTodoModel;
