import 'reflect-metadata'
import express, { NextFunction, Request, Response } from 'express'
import { DynamoDBClient, DynamoDBClientConfig } from '@aws-sdk/client-dynamodb'
import bodyParser from "body-parser"
import awsServerlessExpressMiddleware from 'aws-serverless-express/middleware'
import { validate as validateUUID } from 'uuid'
import { isDraftTodo } from "./app.guard"
import { Attribute, AUTO_GENERATE_ATTRIBUTE_STRATEGY, AutoGenerateAttribute, Entity, Table } from '@typedorm/common'
import { createConnection, getEntityManager } from '@typedorm/core'
import { DocumentClientV3 } from "@typedorm/document-client"

const TableName = `todosTable${process.env.ENV && process.env.ENV !== 'NONE' ? '-' + process.env.ENV : ''}`
const path = '/todos'

const TodosTable = new Table({
    name: TableName,
    partitionKey: 'PK',
    sortKey: 'SK',
})

@Entity({
    name: 'todo',
    primaryKey: {
        partitionKey: 'USER#{{userId}}',
        sortKey: 'TODO#{{id}}'
    }
})
export class Todo {
    @AutoGenerateAttribute({ strategy: AUTO_GENERATE_ATTRIBUTE_STRATEGY.UUID4 })
    id?: string

    @Attribute()
    userId: string

    @Attribute()
    name: string

    @Attribute()
    completed: boolean = false

    @AutoGenerateAttribute({ strategy: AUTO_GENERATE_ATTRIBUTE_STRATEGY.ISO_DATE, autoUpdate: true })
    updatedAt?: string

    constructor(userId: string, name: string, completed: boolean) {
        this.userId = userId
        this.name = name
        this.completed = completed
    }
}

function isTodo(obj: any): obj is Todo {
    return obj && typeof obj === 'object'
        && typeof obj.id === 'string'
        && typeof obj.userId === 'string'
        && typeof obj.name === 'string'
        && typeof obj.completed === 'boolean'
        && typeof obj.updatedAt === 'string'
}

export const app = express()

function typedormMiddleware(configuration: DynamoDBClientConfig) {

    const documentClient = new DocumentClientV3(new DynamoDBClient(configuration))
    createConnection({
        table: TodosTable,
        entities: [ Todo ],
        documentClient,
    })

    return (req: Request, res: Response, next: NextFunction) => {
        next()
    }
}

app.use(typedormMiddleware({ region: process.env.TABLE_REGION }))
app.use(bodyParser.json())
app.use(awsServerlessExpressMiddleware.eventContext())
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*')
    res.header('Access-Control-Allow-Headers', '*')
    next()
})
app.use((req, res, next) => {
    if (req.apiGateway) {
        res.locals.userId = req.apiGateway.event.requestContext.identity.cognitoIdentityId ?? 'UNAUTH'
    }
    next()
})

interface Success<T> {
    data: T
    error?: undefined
}

interface Error {
    data?: undefined
    error: string
}

export interface DraftTodo extends Pick<Todo, 'name' | 'completed'> {}

function isCollection<T>(obj: any, test: (obj: any) => boolean): obj is T {
    return obj
        && Array.isArray(obj)
        && obj.reduce((acc, cur) => acc && test(cur), true)
}

// list
app.get<never, Success<Todo[]>>(path, async (req, res) => {

    const { userId } = res.locals

    const { items: todos } = await getEntityManager().find(Todo, { userId }, { keyCondition: {
        BEGINS_WITH: 'TODO#'
        }
    })

    if (!isCollection<Todo[]>(todos, isTodo)) throw `Could not load items ${todos}`

    res.json({ data: todos })

})

// get item
app.get<{ id: string }, Success<Todo>>(path + '/:id', async (req, res) => {

    const { id } = req.params
    if (!validateUUID(id)) throw 'id is not a valid UUID'

    const { userId } = res.locals

    const todo = await getEntityManager().findOne(Todo, { userId, id })

    if (!isTodo(todo)) throw 'Item is not a todo'

    res.json({ data: todo })

})

// create item
app.post<never, Success<Todo>>(path, async (req, res) => {

    const { userId } = res.locals

    if (!isDraftTodo(req.body)) throw 'Request body is not a valid todo'

    const todo = await getEntityManager().create<Todo>(new Todo(userId, req.body.name, req.body.completed))

    if (!isTodo(todo)) throw `Creation failed, got ${todo}`

    res.json({ data: todo })

})

// delete item
app.delete<{ id: string }, Success<boolean>>(path + '/:id', async (req, res) => {

    const { userId } = res.locals
    const { id } = req.params
    if (!validateUUID(id)) throw 'id is not a valid UUID'

    const { success } = await getEntityManager().delete(Todo, { userId, id })

    res.json({ data: success })

})

// toggle item
app.put<{ id: string }, Success<any>>(`${path}/:id`, async (req, res) => {

    const { userId } = res.locals

    const { id } = req.params
    if (!validateUUID(id)) throw 'id is not a valid UUID'

    const todo = await getEntityManager().findOne(Todo, { userId, id })

    if (!isTodo(todo)) throw 'Item is not a todo'

    const updated = await getEntityManager().update(Todo, todo, { ...todo, completed: !todo.completed })

    res.json({ data: updated ?? todo })

})

// catch all to return error for bad path/method (malformed client request)
app.use((req, res) => {
    res
        .status(400)
        .json({ error: `Cannot ${req.method} ${req.url}` })
})

// error handler to return error response
app.use<{}, Error>((err: Error, req: Request, res: Response, next: NextFunction) => {
    res
        .status(500)
        .json({ error: String(err) })
})

app.listen(3000, () => console.log('App started'))