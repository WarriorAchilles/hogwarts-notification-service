import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { SecretsManager } from "aws-sdk";
import * as mysql from "mysql2/promise";

const DB_HOST = process.env.DB_HOST || "";
const DB_SECRET = process.env.DB_SECRET || "";

export const handler = async (event: APIGatewayProxyEvent): Promise<void> => {
  console.log("Event received:", JSON.stringify(event, null, 2));

  // receive message from queue
  const message = "placeholder";

  // log message to simulate message being sent

  // update message record in database
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
    database: "HogwartsDb",
  });
  console.log("successfully connected to db: ", connection);

  try {
    // TODO: update this to correct SQL
    const x = await connection.execute(
      `SELECT * FROM Notifications WHERE id EQUALS ${message}`
    );
    console.log("sucessfully updated message in database");
  } catch (e) {
    console.error(`Error interacting with DB: ${e}`);
  }
};
