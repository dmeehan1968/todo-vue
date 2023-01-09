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

interface TodoCommon {
    name: string
    completed: boolean
}

interface TodoStore extends TodoCommon {
    PK: string
    SK: string
}

interface TodoModel extends TodoCommon {
    id: string
}

function isTodoStore(obj: any): obj is TodoStore {
    return obj
        && typeof obj === 'object'
        && typeof obj.PK === 'string'
        && typeof obj.SK === 'string'
        && typeof obj.name === 'string'
        && typeof obj.completed === 'boolean'
}

function isTodoModel(obj: any): obj is TodoModel {
    return obj
        && typeof obj === 'object'
        && typeof obj.id === 'string'
        && typeof obj.name === 'string'
        && typeof obj.completed === 'boolean'
}

const mapTodoStoreToModel = (item: Record<string, any>) => {
    if (!(isTodoStore(item))) throw 'Result is not a valid Todo'
    const { SK, name, completed } = item
    return { id: SK.split('#').pop()!, name, completed }
}

const mapTodoModelToStore = (userId: string) => (item: TodoModel) => {
    if (!(isTodoModel(item))) throw 'Result is not a valid Todo'
    const { id, name, completed } = item
    return { PK: `USER#${userId}`, SK: `TODO#${id}`, name, completed }
}

type CreateTodoInput = Omit<TodoModel, 'id'>

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
app.get<never, Success<TodoModel[]>>(path, async (req, res) => {

    const { dynamo, userId } = res.locals
    if (!isDynamoDBDocument(dynamo)) throw 'Dynamo Document client is missing'

    let { Items: todos } = await dynamo.query({
        TableName,
        KeyConditionExpression: 'PK = :userId and begins_with(SK,:todoId)',
        ExpressionAttributeValues: {
            ':userId': `USER#${userId}`,
            ':todoId': `TODO#`,
        }
    })

    todos = todos?.map(mapTodoStoreToModel)

    if (!isCollection<TodoModel[]>(todos, isTodoModel)) throw `Could not load items ${todos}`

    res.json({ data: todos })

})

// get item
app.get<{ id: string }, Success<TodoModel>>(path + '/:id', async (req, res) => {

    const { id } = req.params
    if (!validateUUID(id)) throw 'id is not a valid UUID'

    const { dynamo, userId } = res.locals
    if (!isDynamoDBDocument(dynamo)) throw 'Dynamo Document client is missing'

    let { Item: todo } = await dynamo.get({
        TableName,
        Key: {
            PK: `USER#${userId}`,
            SK: `TODO#${id}`,
        }
    })

    if (!isTodoStore(todo)) throw 'Item is not a todo'

    todo = mapTodoStoreToModel(todo)

    if (!isTodoModel(todo)) throw 'Could not fetch item'

    res.json({ data: todo })

})

// create item
app.post<never, Success<TodoModel>>(path, async (req, res) => {

    const { dynamo, userId } = res.locals
    if (!isDynamoDBDocument(dynamo)) throw 'Dynamo Document client is missing'

    if (!isCreateTodoInput(req.body)) throw 'Request body is not a valid todo'

    const Item = mapTodoModelToStore(userId)({
        ...req.body,
        id: uuid()
    })

    await dynamo.put({
        TableName,
        Item,
    })

    res.json({ data: mapTodoStoreToModel(Item) })

})

// delete item
app.delete<{ id: string }, Success<any>>(path + '/:id', async (req, res) => {

    const { dynamo, userId } = res.locals
    if (!isDynamoDBDocument(dynamo)) throw 'Dynamo Document client is missing'

    const { id } = req.params
    if (!validateUUID(id)) throw 'id is not a valid UUID'

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
app.put<{ id: string }, Success<TodoModel>>(`${path}/:id`, async (req, res) => {

    const { dynamo, userId } = res.locals
    if (!isDynamoDBDocument(dynamo)) throw 'Dynamo Document client is missing'

    const { id } = req.params
    if (!validateUUID(id)) throw 'id is not a valid UUID'

    let { Item: todo } = await dynamo.get( {
        TableName,
        Key: {
            PK: `USER#${userId}`,
            SK: `TODO#${id}`,
        }
    })

    if (!isTodoStore(todo)) throw 'Item is not a todo'

    todo = mapTodoStoreToModel(todo)

    if (!isTodoModel(todo)) throw 'No matching todo'

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