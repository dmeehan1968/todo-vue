import express, { Request, Response, NextFunction } from 'express'
import AWS from 'aws-sdk'
import bodyParser from "body-parser"
import awsServerlessExpressMiddleware from 'aws-serverless-express/middleware'
import uuid from 'uuid'
import { addAsync } from "@awaitjs/express"

AWS.config.update({ region: process.env.TABLE_REGION })

const dynamodb = new AWS.DynamoDB.DocumentClient()

const TableName = `todosTable${process.env.ENV && process.env.ENV !== 'NONE' ? '-' + process.env.ENV : ''}`
const path = '/todos'

export const app = addAsync(express())

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
app.getAsync<never, Success<Todo[]>>(path, async (req, res) => {
    const data = await dynamodb
        .scan({ TableName })
        .promise()

    if (isCollection<Todo[]>(data.Items, isTodo)) {
        res.json({ data: data.Items })
    } else {
        throw 'Could not load items'
    }
})

// get item
app.getAsync<{ id: string}, Success<Todo>>(path + '/:id', async (req, res) => {
    const { id } = req.params

    if (!uuid.validate(id)) {
        throw 'id is not a valid UUID'
    }

    const data = await dynamodb
        .get({ TableName, Key: { id } })
        .promise()

    if (!isTodo(data.Item)) {
        throw 'Could not fetch item'
    }
    res.json({ data: data.Item as Todo })
})

// create item
app.postAsync<never, Success<any>>(path, async (req, res) => {

    const todo = req.body

    if (!isCreateTodoInput(todo)) {
        throw 'Request body is not a valid todo'
    }

    const data = await dynamodb
        .put({ TableName, Item: todo })
        .promise()

    res.json({ data })
})

// toggle item
app.putAsync<{ id: string }, Success<any>>(`${path}/:id`, async (req, res) => {
    const { id } = req.params

    if (!uuid.validate(id)) {
        throw 'id is not a valid UUID'
    }

    const { Item: todo } = await dynamodb
        .get( { TableName, Key: { id } })
        .promise()

    if (!isTodo(todo)) {
        throw 'No matching todo'
    }

    const update = await dynamodb
        .put( { TableName, Item: { ...todo, completed: !todo.completed } })
        .promise()

    res.json({ data: update })
})

app.use<{}, Error>((err: Error, req: Request, res: Response, next: NextFunction) => {
    res
        .status(500)
        .json({ error: String(err) })
})

app.listen(3000, () => console.log('App started'))