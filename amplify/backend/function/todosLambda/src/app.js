"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = void 0;
const express_1 = __importDefault(require("express"));
const aws_sdk_1 = __importDefault(require("aws-sdk"));
const body_parser_1 = __importDefault(require("body-parser"));
const middleware_1 = __importDefault(require("aws-serverless-express/middleware"));
const uuid_1 = __importDefault(require("uuid"));
const express_2 = require("@awaitjs/express");
aws_sdk_1.default.config.update({ region: process.env.TABLE_REGION });
const dynamodb = new aws_sdk_1.default.DynamoDB.DocumentClient();
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
        .scan({ TableName })
        .promise();
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
    if (!uuid_1.default.validate(id)) {
        throw 'id is not a valid UUID';
    }
    const data = await dynamodb
        .get({ TableName, Key: { id } })
        .promise();
    if (!isTodo(data.Item)) {
        throw 'Could not fetch item';
    }
    res.json({ data: data.Item });
});
// create item
exports.app.postAsync(path, async (req, res) => {
    const todo = req.body;
    if (!isCreateTodoInput(todo)) {
        throw 'Request body is not a valid todo';
    }
    const data = await dynamodb
        .put({ TableName, Item: todo })
        .promise();
    res.json({ data });
});
// toggle item
exports.app.putAsync(`${path}/:id`, async (req, res) => {
    const { id } = req.params;
    if (!uuid_1.default.validate(id)) {
        throw 'id is not a valid UUID';
    }
    const { Item: todo } = await dynamodb
        .get({ TableName, Key: { id } })
        .promise();
    if (!isTodo(todo)) {
        throw 'No matching todo';
    }
    const update = await dynamodb
        .put({ TableName, Item: Object.assign(Object.assign({}, todo), { completed: !todo.completed }) })
        .promise();
    res.json({ data: update });
});
exports.app.use((err, req, res, next) => {
    res
        .status(500)
        .json({ error: String(err) });
});
exports.app.listen(3000, () => console.log('App started'));
