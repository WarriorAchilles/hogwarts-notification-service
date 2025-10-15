import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import {
  SQSClient,
  SendMessageCommandInput,
  SendMessageCommand,
} from "@aws-sdk/client-sqs";
import { SecretsManager } from "aws-sdk";
import * as mysql from "mysql2/promise";

const NOTIFICATION_QUEUE_URL = process.env.NOTIFICATION_QUEUE_URL || "";
const DB_HOST = process.env.DB_HOST || "";
const DB_SECRET = process.env.DB_SECRET || "";

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  console.log("Event received:", JSON.stringify(event, null, 2));

  if (event.body) {
    const payload = JSON.parse(event.body);

    // payload = {
    //   recipient: "string",
    //   message: "string"
    // }
    console.log("payload: ", payload);
    const secretsManager = new SecretsManager();
    const secretData = await secretsManager
      .getSecretValue({ SecretId: DB_SECRET })
      .promise();
    const { username, password } = JSON.parse(secretData.SecretString!);
    console.log(`got the db secrets. User: ${username}, Pass: ${password}`);

    const connection = await mysql.createConnection({
      host: DB_HOST,
      user: username,
      password: password,
      multipleStatements: true,
    });
    console.log("successfully connected to db: ", connection);

    try {
      // TODO: check if payload is formatted properly and has all data
      const x = await connection.execute(
        `INSERT INTO Notifications VALUES ('${payload.recipient}', '${payload.message}', 'queued')`
      );
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: x,
          input: event,
        }),
      };
    } catch (e) {
      return {
        statusCode: 500,
        headers: { "Content-Type": "application/json" },
        body: `Error interacting with DB: ${e}`,
      };
    }

    // add notification to database

    // queue notification for processing
    const sqsClient = new SQSClient();

    const params: SendMessageCommandInput = {
      QueueUrl: NOTIFICATION_QUEUE_URL,
      MessageBody: "messageBody",
    };

    console.info("Adding notification to SQS Queue");
    console.info(JSON.stringify(params, null, 2));
    const command = new SendMessageCommand(params);

    try {
      const data = await sqsClient.send(command);
      console.info(`Message sent: ${JSON.stringify(data, null, 2)}`);
    } catch (e) {
      console.error("Error sending message: ", e);
    }
  } else {
    return {
      statusCode: 402,
      headers: { "Content-Type": "application/json" },
      body: "Bad Request: No payload provided. Must provide a recipient and a message.",
    };
  }
};
