import express, { Request, Response, NextFunction } from 'express'
import { DynamoDBClient, DynamoDBClientConfig } from '@aws-sdk/client-dynamodb'
import bodyParser from "body-parser"
import awsServerlessExpressMiddleware from 'aws-serverless-express/middleware'
import { v4 as uuid, validate as validateUUID } from 'uuid'
import { DynamoDBDocument } from "@aws-sdk/lib-dynamodb"

const TableName = `userTodosTable${process.env.ENV && process.env.ENV !== 'NONE' ? '-' + process.env.ENV : ''}`
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
app.use((req, res) => {
    if (req.apiGateway) {
        res.locals.userId = req.apiGateway.event.requestContext.identity.cognitoIdentityId ?? 'UNAUTH'
    }
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
app.get<never, Success<any>>(path, async (req, res, next) => {
    const { dynamo, userId } = res.locals
    if (!isDynamoDBDocument(dynamo)) return next('Dynamo Document client is missing')

    // const result = await dynamo.query({
    //     TableName,
    //     KeyConditionExpression: 'PK = USER#:userId and begins_with(SK,"TODO#")',
    //     ExpressionAttributeValues: { ':userId': userId }
    // })

    // if (!isCollection<Todo[]>(todos, isTodo)) return next('Could not load items')

    // res.json({ data: todos })
    res.json({ data: userId })
})

// get item
app.get<{ id: string }, Success<Todo>>(path + '/:id', async (req, res, next) => {
    const { id } = req.params
    if (!validateUUID(id)) return next('id is not a valid UUID')

    const { dynamo, userId } = res.locals
    if (!isDynamoDBDocument(dynamo)) return next('Dynamo Document client is missing')

    const { Item: todo } = await dynamo.get({
        TableName,
        Key: {
            PK: `USER#${userId}`,
            SK: `TODO#${id}`,
        }
    })

    if (!isTodo(todo)) return next('Could not fetch item')

    res.json({ data: todo })
})

// create item
app.post<never, Success<Todo>>(path, async (req, res, next) => {

    const { dynamo, userId } = res.locals
    if (!isDynamoDBDocument(dynamo)) return next('Dynamo Document client is missing')

    if (!isCreateTodoInput(req.body)) return next('Request body is not a valid todo')

    const id = uuid()
    const { name, completed } = req.body

    const Item = {
        PK: `USER#${userId}`,
        SK: `TODO#${id}`,
        name,
        completed
    }

    await dynamo.put({
        TableName,
        Item,
    })

    res.json({ data: { id, name, completed } })
})

// delete item
app.delete<{ id: string }, Success<any>>(path + '/:id', async (req, res, next) => {
    const { dynamo, userId } = res.locals
    if (!isDynamoDBDocument(dynamo)) return next('Dynamo Document client is missing')

    const { id } = req.params
    if (!validateUUID(id)) return next('id is not a valid UUID')

    await dynamo.delete({
        TableName,
        Key: {
            PK: `USER#${userId}`,
            SK: `TODO#${id}`,
        }
    })

    res.json({ data: {} })
})

// toggle item
app.put<{ id: string }, Success<Todo>>(`${path}/:id`, async (req, res, next) => {
    const { dynamo, userId } = res.locals
    if (!isDynamoDBDocument(dynamo)) return next('Dynamo Document client is missing')

    const { id } = req.params
    if (!validateUUID(id)) return next('id is not a valid UUID')

    const { Item: todo } = await dynamo.get( {
        TableName,
        Key: {
            PK: `USER#${userId}`,
            SK: `TODO#${id}`,
        }
    })

    if (!isTodo(todo)) return next('No matching todo')

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
    })

    res.json({ data: { ...todo, ...updated.Attributes } })
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