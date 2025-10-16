import { SQSEvent } from "aws-lambda";
import getDb from "../util/dbConnector";

const DB_HOST = process.env.DB_HOST || "";
const DB_SECRET = process.env.DB_SECRET || "";

export const handler = async (event: SQSEvent): Promise<void> => {
  console.log("Event received:", JSON.stringify(event, null, 2));

  // receive message from queue
  try {
    const payload = JSON.parse(event.Records[0].body);
    // log message to simulate message being sent
    console.log(`Message sent to ${payload.recipient}: ${payload.message}`);

    // update message record in database
    const db = await getDb(DB_HOST, DB_SECRET);
    try {
      await db.execute(
        `UPDATE Notifications SET status = 'delivered' WHERE id = '${payload.notificationId}'`
      );
      console.log("sucessfully updated message in database");
    } catch (e) {
      console.error(`Error interacting with DB: ${e}`);
    }
  } catch (e) {
    console.error(e);
  }
};
