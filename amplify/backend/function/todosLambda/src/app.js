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
const lib_dynamodb_1 = require("@aws-sdk/lib-dynamodb");
const TableName = `todosTable${process.env.ENV && process.env.ENV !== 'NONE' ? '-' + process.env.ENV : ''}`;
const path = '/todos';
exports.app = (0, express_1.default)();
function dynamoDBExpressMiddleware(configuration) {
    const dbClient = new client_dynamodb_1.DynamoDBClient(configuration);
    const docClient = lib_dynamodb_1.DynamoDBDocument.from(dbClient);
    return (req, res, next) => {
        res.locals.dynamo = docClient;
        next();
    };
}
function isDynamoDBDocument(obj) {
    return obj && typeof obj === 'object' && obj.constructor.name === 'DynamoDBDocument';
}
exports.app.use(dynamoDBExpressMiddleware({ region: process.env.TABLE_REGION }));
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
exports.app.get(path, async (req, res, next) => {
    const { dynamo } = res.locals;
    if (!isDynamoDBDocument(dynamo))
        return next('Dynamo Document client is missing');
    const { Items: todos } = await dynamo.scan({ TableName });
    if (!isCollection(todos, isTodo))
        return next('Could not load items');
    res.json({ data: todos });
});
// get item
exports.app.get(path + '/:id', async (req, res, next) => {
    const { id } = req.params;
    if (!(0, uuid_1.validate)(id))
        return next('id is not a valid UUID');
    const { dynamo } = res.locals;
    if (!isDynamoDBDocument(dynamo))
        return next('Dynamo Document client is missing');
    const { Item: todo } = await dynamo.get({ TableName, Key: { id } });
    if (!isTodo(todo))
        return next('Could not fetch item');
    res.json({ data: todo });
});
// create item
exports.app.post(path, async (req, res, next) => {
    const { dynamo } = res.locals;
    if (!isDynamoDBDocument(dynamo))
        return next('Dynamo Document client is missing');
    if (!isCreateTodoInput(req.body))
        return next('Request body is not a valid todo');
    const todo = Object.assign(Object.assign({}, req.body), { id: (0, uuid_1.v4)() });
    await dynamo.put({
        TableName,
        Item: todo,
    });
    res.json({ data: todo });
});
// delete item
exports.app.delete(path + '/:id', async (req, res, next) => {
    const { dynamo } = res.locals;
    if (!isDynamoDBDocument(dynamo))
        return next('Dynamo Document client is missing');
    const { id } = req.params;
    if (!(0, uuid_1.validate)(id))
        return next('id is not a valid UUID');
    const data = await dynamo.delete({ TableName, Key: { id } });
    res.json({ data });
});
// toggle item
exports.app.put(`${path}/:id`, async (req, res, next) => {
    const { dynamo } = res.locals;
    if (!isDynamoDBDocument(dynamo))
        return next('Dynamo Document client is missing');
    const { id } = req.params;
    if (!(0, uuid_1.validate)(id))
        return next('id is not a valid UUID');
    const { Item: todo } = await dynamo.get({ TableName, Key: { id } });
    if (!isTodo(todo))
        return next('No matching todo');
    const update = await dynamo.update({
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
    res.json({ data: Object.assign(Object.assign({}, todo), update.Attributes) });
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
