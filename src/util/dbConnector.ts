import { SecretsManager } from "aws-sdk";
import * as mysql from "mysql2/promise";

export default async function getDb(
  host: string,
  secret: string
): Promise<mysql.Connection> {
  const secretsManager = new SecretsManager();
  const secretData = await secretsManager
    .getSecretValue({ SecretId: secret })
    .promise();
  const { username, password } = JSON.parse(secretData.SecretString!);
  console.log(`got the db secrets. User: ${username}, Pass: ${password}`);

  const connection = await mysql.createConnection({
    host: host,
    user: username,
    password: password,
    multipleStatements: true,
    database: "HogwartsDb",
  });
  console.log("successfully connected to db: ", connection);
  return connection;
}
