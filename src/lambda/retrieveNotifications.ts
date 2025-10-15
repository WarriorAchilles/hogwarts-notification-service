import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { SecretsManager } from "aws-sdk";
import * as mysql from "mysql2/promise";

const DB_HOST = process.env.DB_HOST || "";
const DB_SECRET = process.env.DB_SECRET || "";

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  console.log("Event received:", JSON.stringify(event, null, 2));

  const recipient = "placeholder";

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
    const x = await connection.execute(
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
