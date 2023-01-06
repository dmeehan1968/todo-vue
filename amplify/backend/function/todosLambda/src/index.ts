import awsServerlessExpress from 'aws-serverless-express'
import { app } from './app'
import type { APIGatewayProxyHandler } from "aws-lambda"

const server = awsServerlessExpress.createServer(app);

export const handler: APIGatewayProxyHandler = (event, context) => {
    console.log(`EVENT: ${JSON.stringify(event)}`);
    return awsServerlessExpress.proxy(server, event, context, 'PROMISE').promise;
};
