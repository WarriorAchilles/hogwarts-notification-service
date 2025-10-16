import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import getDb from "../util/dbConnector";

const DB_HOST = process.env.DB_HOST || "";
const DB_SECRET = process.env.DB_SECRET || "";

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  console.log("Event received:", JSON.stringify(event, null, 2));

  const recipient = "placeholder";
  const db = await getDb(DB_HOST, DB_SECRET);

  try {
    // TODO if I have time: guard against SQL injection
    const x = await db.execute(
      `SELECT * FROM Notifications WHERE recipient EQUALS ${recipient}`
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
};
