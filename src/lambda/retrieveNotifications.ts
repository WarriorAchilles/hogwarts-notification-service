import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import getDb from "../util/dbConnector";

const DB_HOST = process.env.DB_HOST || "";
const DB_SECRET = process.env.DB_SECRET || "";

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  console.log("Event received:", JSON.stringify(event, null, 2));

  if (event.pathParameters && event.pathParameters.recipient) {
    const recipient = decodeURIComponent(event.pathParameters.recipient);
    const db = await getDb(DB_HOST, DB_SECRET);

    try {
      let items;
      if (event.queryStringParameters && event.queryStringParameters.limit) {
        // with limit param
        items = await db.execute(
          "SELECT * FROM Notifications WHERE recipient = ? LIMIT ?",
          [recipient, event.queryStringParameters.limit]
        );
      } else {
        // no limit param
        items = await db.execute(
          "SELECT * FROM Notifications WHERE recipient = ?",
          [recipient]
        );
      }
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(items[0], null, 2),
      };
    } catch (e) {
      return {
        statusCode: 500,
        headers: { "Content-Type": "application/json" },
        body: `Error interacting with DB: ${e}`,
      };
    }
  }
  return {
    statusCode: 400,
    headers: { "Content-Type": "application/json" },
    body: "No recipient path parameter specified.",
  };
};
