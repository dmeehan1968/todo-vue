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
exports.app.use((req, res, next) => {
    var _a;
    if (req.apiGateway) {
        res.locals.userId = (_a = req.apiGateway.event.requestContext.identity.cognitoIdentityId) !== null && _a !== void 0 ? _a : 'UNAUTH';
    }
    next();
});
function isTodoStore(obj) {
    return obj
        && typeof obj === 'object'
        && typeof obj.PK === 'string'
        && typeof obj.SK === 'string'
        && typeof obj.name === 'string'
        && typeof obj.completed === 'boolean';
}
function isTodoModel(obj) {
    return obj
        && typeof obj === 'object'
        && typeof obj.id === 'string'
        && typeof obj.name === 'string'
        && typeof obj.completed === 'boolean';
}
const mapTodoStoreToModel = (item) => {
    if (!(isTodoStore(item)))
        throw 'Result is not a valid Todo';
    const { SK, name, completed } = item;
    return { id: SK.split('#').pop(), name, completed };
};
const mapTodoModelToStore = (userId) => (item) => {
    if (!(isTodoModel(item)))
        throw 'Result is not a valid Todo';
    const { id, name, completed } = item;
    return { PK: `USER#${userId}`, SK: `TODO#${id}`, name, completed };
};
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
    await (async () => {
        const { dynamo, userId } = res.locals;
        if (!isDynamoDBDocument(dynamo))
            throw 'Dynamo Document client is missing';
        let { Items: todos } = await dynamo.query({
            TableName,
            KeyConditionExpression: 'PK = :userId and begins_with(SK,:todoId)',
            ExpressionAttributeValues: {
                ':userId': `USER#${userId}`,
                ':todoId': `TODO#`,
            }
        });
        todos = todos === null || todos === void 0 ? void 0 : todos.map(mapTodoStoreToModel);
        if (!isCollection(todos, isTodoModel))
            throw `Could not load items ${todos}`;
        res.json({ data: todos });
    })().catch(next);
});
// get item
exports.app.get(path + '/:id', async (req, res, next) => {
    await (async () => {
        const { id } = req.params;
        if (!(0, uuid_1.validate)(id))
            throw 'id is not a valid UUID';
        const { dynamo, userId } = res.locals;
        if (!isDynamoDBDocument(dynamo))
            throw 'Dynamo Document client is missing';
        let { Item: todo } = await dynamo.get({
            TableName,
            Key: {
                PK: `USER#${userId}`,
                SK: `TODO#${id}`,
            }
        });
        if (!isTodoStore(todo))
            throw 'Item is not a todo';
        todo = mapTodoStoreToModel(todo);
        if (!isTodoModel(todo))
            throw 'Could not fetch item';
        res.json({ data: todo });
    })().catch(next);
});
// create item
exports.app.post(path, async (req, res, next) => {
    await (async () => {
        const { dynamo, userId } = res.locals;
        if (!isDynamoDBDocument(dynamo))
            throw 'Dynamo Document client is missing';
        if (!isCreateTodoInput(req.body))
            throw 'Request body is not a valid todo';
        const Item = mapTodoModelToStore(userId)(Object.assign(Object.assign({}, req.body), { id: (0, uuid_1.v4)() }));
        await dynamo.put({
            TableName,
            Item,
        });
        res.json({ data: mapTodoStoreToModel(Item) });
    })().catch(next);
});
// delete item
exports.app.delete(path + '/:id', async (req, res, next) => {
    await (async () => {
        const { dynamo, userId } = res.locals;
        if (!isDynamoDBDocument(dynamo))
            throw 'Dynamo Document client is missing';
        const { id } = req.params;
        if (!(0, uuid_1.validate)(id))
            throw 'id is not a valid UUID';
        await dynamo.delete({
            TableName,
            Key: {
                PK: `USER#${userId}`,
                SK: `TODO#${id}`,
            }
        });
        res.json({ data: {} });
    })().catch(next);
});
// toggle item
exports.app.put(`${path}/:id`, async (req, res, next) => {
    await (async () => {
        const { dynamo, userId } = res.locals;
        if (!isDynamoDBDocument(dynamo))
            throw 'Dynamo Document client is missing';
        const { id } = req.params;
        if (!(0, uuid_1.validate)(id))
            throw 'id is not a valid UUID';
        let { Item: todo } = await dynamo.get({
            TableName,
            Key: {
                PK: `USER#${userId}`,
                SK: `TODO#${id}`,
            }
        });
        if (!isTodoStore(todo))
            throw 'Item is not a todo';
        todo = mapTodoStoreToModel(todo);
        if (!isTodoModel(todo))
            throw 'No matching todo';
        const updated = await dynamo.update({
            TableName,
            Key: {
                PK: `USER#${userId}`,
                SK: `TODO#${todo.id}`,
            },
            ConditionExpression: '#completed = :old_completed',
            UpdateExpression: 'SET #completed = :new_completed',
            ExpressionAttributeNames: { '#completed': 'completed' },
            ExpressionAttributeValues: {
                ':old_completed': todo.completed,
                ':new_completed': !todo.completed
            },
            ReturnValues: 'UPDATED_NEW'
        });
        res.json({ data: Object.assign(Object.assign({}, todo), updated.Attributes) });
    })().catch(next);
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
