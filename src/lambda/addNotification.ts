import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import {
  SQSClient,
  SendMessageCommandInput,
  SendMessageCommand,
} from "@aws-sdk/client-sqs";
import { randomUUID } from "crypto";
import getDb from "../util/dbConnector";

const NOTIFICATION_QUEUE_URL = process.env.NOTIFICATION_QUEUE_URL || "";
const DB_HOST = process.env.DB_HOST || "";
const DB_SECRET = process.env.DB_SECRET || "";

type notificationPayload = {
  recipient?: string;
  message?: string;
};

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  console.log("Event received:", JSON.stringify(event, null, 2));

  if (event.body) {
    const payload: notificationPayload = JSON.parse(event.body);
    console.log("payload: ", payload);

    if (!payload.recipient) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: "Bad Request: Recipient is required.",
      };
    }
    if (!payload.message) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: "Bad Request: Message is required.",
      };
    }
    const db = await getDb(DB_HOST, DB_SECRET);

    const id = randomUUID();
    try {
      // TODO if I have time, make sure to guard against SQL injection
      // add notification to database
      await db.execute(
        `INSERT INTO Notifications (id, recipient, message, status) VALUES ('${id}', '${payload.recipient}', '${payload.message}', 'queued')`
      );
    } catch (e) {
      return {
        statusCode: 500,
        headers: { "Content-Type": "application/json" },
        body: `Error interacting with DB: ${e}`,
      };
    }
    console.log("sucessfully added message to database!");

    // queue notification for processing
    const sqsClient = new SQSClient();

    const params: SendMessageCommandInput = {
      QueueUrl: NOTIFICATION_QUEUE_URL,
      MessageBody: JSON.stringify(
        {
          notificationId: id,
          message: payload.message,
          recipient: payload.recipient,
        },
        null,
        2
      ),
    };

    console.info("Adding notification to SQS Queue");
    console.info(JSON.stringify(params, null, 2));
    const command = new SendMessageCommand(params);

    try {
      const data = await sqsClient.send(command);
      console.info(`Message sent: ${JSON.stringify(data, null, 2)}`);
    } catch (e) {
      return {
        statusCode: 500,
        headers: { "Content-Type": "application/json" },
        body: `Error adding message to queue: ${e}`,
      };
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: "Successfully queued notification!",
    };
  } else {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: "Bad Request: No payload provided. Must provide a recipient and a message.",
    };
  }
};
