"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = void 0;
const express_1 = __importDefault(require("express"));
const client_dynamodb_1 = require("@aws-sdk/client-dynamodb");
const body_parser_1 = __importDefault(require("body-parser"));
const middleware_1 = __importDefault(require("aws-serverless-express/middleware"));
const uuid_1 = require("uuid");
const express_2 = require("@awaitjs/express");
const lib_dynamodb_1 = require("@aws-sdk/lib-dynamodb");
const ddbclient = new client_dynamodb_1.DynamoDBClient({ region: process.env.TABLE_REGION });
const dynamodb = lib_dynamodb_1.DynamoDBDocument.from(ddbclient);
const TableName = `todosTable${process.env.ENV && process.env.ENV !== 'NONE' ? '-' + process.env.ENV : ''}`;
const path = '/todos';
exports.app = (0, express_2.addAsync)((0, express_1.default)());
exports.app.use(body_parser_1.default.json());
exports.app.use(middleware_1.default.eventContext());
exports.app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', '*');
    next();
});
function isTodo(obj) {
    return obj
        && typeof obj === 'object'
        && typeof obj.id === 'string'
        && typeof obj.name === 'string'
        && typeof obj.completed === 'boolean';
}
function isCreateTodoInput(obj) {
    return obj
        && typeof obj === 'object'
        && typeof obj.id === 'undefined'
        && typeof obj.name === 'string'
        && typeof obj.completed === 'boolean';
}
function isCollection(obj, test) {
    return obj
        && Array.isArray(obj)
        && obj.reduce((acc, cur) => acc && test(cur), true);
}
// list
exports.app.getAsync(path, async (req, res) => {
    const data = await dynamodb
        .scan({ TableName });
    if (isCollection(data.Items, isTodo)) {
        res.json({ data: data.Items });
    }
    else {
        throw 'Could not load items';
    }
});
// get item
exports.app.getAsync(path + '/:id', async (req, res) => {
    const { id } = req.params;
    if (!(0, uuid_1.validate)(id)) {
        throw 'id is not a valid UUID';
    }
    const data = await dynamodb
        .get({ TableName, Key: { id } });
    if (!isTodo(data.Item)) {
        throw 'Could not fetch item';
    }
    res.json({ data: data.Item });
});
// create item
exports.app.postAsync(path, async (req, res) => {
    if (!isCreateTodoInput(req.body)) {
        throw 'Request body is not a valid todo';
    }
    const todo = Object.assign(Object.assign({}, req.body), { id: (0, uuid_1.v4)() });
    const data = await dynamodb
        .put({
        TableName,
        Item: todo
    });
    res.json({ data: todo });
});
// toggle item
exports.app.putAsync(`${path}/:id`, async (req, res) => {
    const { id } = req.params;
    if (!(0, uuid_1.validate)(id)) {
        throw 'id is not a valid UUID';
    }
    const { Item: todo } = await dynamodb
        .get({ TableName, Key: { id } });
    if (!isTodo(todo)) {
        throw 'No matching todo';
    }
    const update = await dynamodb
        .update({
        TableName,
        Key: { id: todo.id },
        ConditionExpression: '#completed = :old_completed',
        UpdateExpression: 'SET #completed = :new_completed',
        ExpressionAttributeNames: { '#completed': 'completed' },
        ExpressionAttributeValues: {
            ':old_completed': todo.completed,
            ':new_completed': !todo.completed
        },
        ReturnValues: 'UPDATED_NEW'
    });
    res.json({ data: update });
});
// catch all to return error for bad path/method (malformed client request)
exports.app.use((req, res) => {
    res
        .status(400)
        .json({ error: `Cannot ${req.method} ${req.url}` });
});
// error handler to return error response
exports.app.use((err, req, res, next) => {
    res
        .status(500)
        .json({ error: String(err) });
});
exports.app.listen(3000, () => console.log('App started'));
