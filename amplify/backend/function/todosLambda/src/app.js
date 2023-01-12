"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = exports.Todo = void 0;
require("reflect-metadata");
const express_1 = __importDefault(require("express"));
const client_dynamodb_1 = require("@aws-sdk/client-dynamodb");
const body_parser_1 = __importDefault(require("body-parser"));
const middleware_1 = __importDefault(require("aws-serverless-express/middleware"));
const uuid_1 = require("uuid");
const app_guard_1 = require("./app.guard");
const common_1 = require("@typedorm/common");
const core_1 = require("@typedorm/core");
const document_client_1 = require("@typedorm/document-client");
const TableName = `todosTable${process.env.ENV && process.env.ENV !== 'NONE' ? '-' + process.env.ENV : ''}`;
const path = '/todos';
const TodosTable = new common_1.Table({
    name: TableName,
    partitionKey: 'PK',
    sortKey: 'SK',
});
let Todo = class Todo {
    constructor(userId, name, completed) {
        this.completed = false;
        this.userId = userId;
        this.name = name;
        this.completed = completed;
    }
};
__decorate([
    (0, common_1.AutoGenerateAttribute)({ strategy: common_1.AUTO_GENERATE_ATTRIBUTE_STRATEGY.UUID4 }),
    __metadata("design:type", String)
], Todo.prototype, "id", void 0);
__decorate([
    (0, common_1.Attribute)(),
    __metadata("design:type", String)
], Todo.prototype, "userId", void 0);
__decorate([
    (0, common_1.Attribute)(),
    __metadata("design:type", String)
], Todo.prototype, "name", void 0);
__decorate([
    (0, common_1.Attribute)(),
    __metadata("design:type", Boolean)
], Todo.prototype, "completed", void 0);
__decorate([
    (0, common_1.AutoGenerateAttribute)({ strategy: common_1.AUTO_GENERATE_ATTRIBUTE_STRATEGY.ISO_DATE, autoUpdate: true }),
    __metadata("design:type", String)
], Todo.prototype, "updatedAt", void 0);
Todo = __decorate([
    (0, common_1.Entity)({
        name: 'todo',
        primaryKey: {
            partitionKey: 'USER#{{userId}}',
            sortKey: 'TODO#{{id}}'
        }
    }),
    __metadata("design:paramtypes", [String, String, Boolean])
], Todo);
exports.Todo = Todo;
function isTodo(obj) {
    return obj && typeof obj === 'object'
        && typeof obj.id === 'string'
        && typeof obj.userId === 'string'
        && typeof obj.name === 'string'
        && typeof obj.completed === 'boolean'
        && typeof obj.updatedAt === 'string';
}
exports.app = (0, express_1.default)();
function typedormMiddleware(configuration) {
    const documentClient = new document_client_1.DocumentClientV3(new client_dynamodb_1.DynamoDBClient(configuration));
    (0, core_1.createConnection)({
        table: TodosTable,
        entities: [Todo],
        documentClient,
    });
    return (req, res, next) => {
        next();
    };
}
exports.app.use(typedormMiddleware({ region: process.env.TABLE_REGION }));
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
function isCollection(obj, test) {
    return obj
        && Array.isArray(obj)
        && obj.reduce((acc, cur) => acc && test(cur), true);
}
// list
exports.app.get(path, async (req, res) => {
    const { userId } = res.locals;
    const { items: todos } = await (0, core_1.getEntityManager)().find(Todo, { userId }, { keyCondition: {
            BEGINS_WITH: 'TODO#'
        }
    });
    if (!isCollection(todos, isTodo))
        throw `Could not load items ${todos}`;
    res.json({ data: todos });
});
// get item
exports.app.get(path + '/:id', async (req, res) => {
    const { id } = req.params;
    if (!(0, uuid_1.validate)(id))
        throw 'id is not a valid UUID';
    const { userId } = res.locals;
    const todo = await (0, core_1.getEntityManager)().findOne(Todo, { userId, id });
    if (!isTodo(todo))
        throw 'Item is not a todo';
    res.json({ data: todo });
});
// create item
exports.app.post(path, async (req, res) => {
    const { userId } = res.locals;
    if (!(0, app_guard_1.isDraftTodo)(req.body))
        throw 'Request body is not a valid todo';
    const todo = await (0, core_1.getEntityManager)().create(new Todo(userId, req.body.name, req.body.completed));
    if (!isTodo(todo))
        throw `Creation failed, got ${todo}`;
    res.json({ data: todo });
});
// delete item
exports.app.delete(path + '/:id', async (req, res) => {
    const { userId } = res.locals;
    const { id } = req.params;
    if (!(0, uuid_1.validate)(id))
        throw 'id is not a valid UUID';
    const { success } = await (0, core_1.getEntityManager)().delete(Todo, { userId, id });
    res.json({ data: success });
});
// toggle item
exports.app.put(`${path}/:id`, async (req, res) => {
    const { userId } = res.locals;
    const { id } = req.params;
    if (!(0, uuid_1.validate)(id))
        throw 'id is not a valid UUID';
    const todo = await (0, core_1.getEntityManager)().findOne(Todo, { userId, id });
    if (!isTodo(todo))
        throw 'Item is not a todo';
    const updated = await (0, core_1.getEntityManager)().update(Todo, todo, Object.assign(Object.assign({}, todo), { completed: !todo.completed }));
    res.json({ data: updated !== null && updated !== void 0 ? updated : todo });
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
