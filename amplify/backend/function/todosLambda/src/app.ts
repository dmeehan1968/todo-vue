import express, { Request, Response, NextFunction } from 'express'
import { DynamoDBClient, DynamoDBClientConfig } from '@aws-sdk/client-dynamodb'
import bodyParser from "body-parser"
import awsServerlessExpressMiddleware from 'aws-serverless-express/middleware'
import { v4 as uuid, validate as validateUUID } from 'uuid'
import { DynamoDBDocument } from "@aws-sdk/lib-dynamodb"

const TableName = `todosTable${process.env.ENV && process.env.ENV !== 'NONE' ? '-' + process.env.ENV : ''}`
const path = '/todos'

export const app = express()

function dynamoDBExpressMiddleware(configuration: DynamoDBClientConfig) {
    const dbClient = new DynamoDBClient(configuration)
    const docClient = DynamoDBDocument.from(dbClient)

    return (req: Request, res: Response, next: NextFunction) => {
        res.locals.dynamo = docClient
        next()
    }
}

function isDynamoDBDocument(obj: any): obj is DynamoDBDocument {
    return obj && typeof obj === 'object' && obj.constructor.name === 'DynamoDBDocument'
}

app.use(dynamoDBExpressMiddleware({ region: process.env.TABLE_REGION }))
app.use(bodyParser.json())
app.use(awsServerlessExpressMiddleware.eventContext())
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*')
    res.header('Access-Control-Allow-Headers', '*')
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

interface Todo {
    id: string
    name: string
    completed: boolean
}

function isTodo(obj: any): obj is Todo {
    return obj
        && typeof obj === 'object'
        && typeof obj.id === 'string'
        && typeof obj.name === 'string'
        && typeof obj.completed === 'boolean'
}

type CreateTodoInput = Omit<Todo, 'id'>

function isCreateTodoInput(obj: any): obj is CreateTodoInput {
    return obj
        && typeof obj === 'object'
        && typeof obj.id === 'undefined'
        && typeof obj.name === 'string'
        && typeof obj.completed === 'boolean'
}

function isCollection<T>(obj: any, test: (obj: any) => boolean): obj is T {
    return obj
        && Array.isArray(obj)
        && obj.reduce((acc, cur) => acc && test(cur), true)
}

// list
app.get<never, Success<Todo[]>>(path, async (req, res, next) => {
    const { dynamo } = res.locals
    if (!isDynamoDBDocument(dynamo)) return next('Dynamo Document client is missing')

    const { Items: todos } = await dynamo.scan({ TableName })

    if (!isCollection<Todo[]>(todos, isTodo)) return next('Could not load items')

    res.json({ data: todos })
})

// get item
app.get<{ id: string }, Success<Todo>>(path + '/:id', async (req, res, next) => {
    const { id } = req.params
    if (!validateUUID(id)) return next('id is not a valid UUID')

    const { dynamo } = res.locals
    if (!isDynamoDBDocument(dynamo)) return next('Dynamo Document client is missing')

    const { Item: todo } = await dynamo.get({ TableName, Key: { id } })

    if (!isTodo(todo)) return next('Could not fetch item')

    res.json({ data: todo })
})

// create item
app.post<never, Success<Todo>>(path, async (req, res, next) => {

    const { dynamo } = res.locals
    if (!isDynamoDBDocument(dynamo)) return next('Dynamo Document client is missing')

    if (!isCreateTodoInput(req.body)) return next('Request body is not a valid todo')

    const todo: Todo = { ...req.body, id: uuid() }

    await dynamo.put({
        TableName,
        Item: todo,
    })

    res.json({ data: todo })
})

// delete item
app.delete<{ id: string }, Success<any>>(path + '/:id', async (req, res, next) => {
    const { dynamo } = res.locals
    if (!isDynamoDBDocument(dynamo)) return next('Dynamo Document client is missing')

    const { id } = req.params
    if (!validateUUID(id)) return next('id is not a valid UUID')

    const data = await dynamo.delete({ TableName, Key: { id } })

    res.json({ data })
})

// toggle item
app.put<{ id: string }, Success<Todo>>(`${path}/:id`, async (req, res, next) => {
    const { dynamo } = res.locals
    if (!isDynamoDBDocument(dynamo)) return next('Dynamo Document client is missing')

    const { id } = req.params
    if (!validateUUID(id)) return next('id is not a valid UUID')

    const { Item: todo } = await dynamo.get( { TableName, Key: { id } })

    if (!isTodo(todo)) return next('No matching todo')

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
    })

    res.json({ data: { ...todo, ...update.Attributes } })
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