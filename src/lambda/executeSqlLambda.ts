import { SecretsManager } from "aws-sdk";
import * as mysql from "mysql2/promise";

const DB_HOST = process.env.DB_HOST || "";
const DB_SECRET = process.env.DB_SECRET || "";

exports.handler = async (event: any) => {
  const secretsManager = new SecretsManager();
  // all this local environment stuff is so I can re-run this lamdba if I need to for some reason
  let endpoint = event?.ResourceProperties?.endpoint ?? DB_HOST;
  let sqlScript =
    event?.ResourceProperties?.sqlScript ??
    `
    CREATE TABLE IF NOT EXISTS Notifications (
      id INT AUTO_INCREMENT PRIMARY KEY,
      recipient VARCHAR(255) NOT NULL,
      message VARCHAR(255) NOT NULL,
      status VARCHAR(255) NOT NULL,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;
  let secretArn = event?.ResourceProperties?.secretArn ?? DB_SECRET;

  try {
    const secretData = await secretsManager
      .getSecretValue({ SecretId: secretArn })
      .promise();
    const { username, password } = JSON.parse(secretData.SecretString!);
    console.log(`got the db secrets. User: ${username}, Pass: ${password}`);

    const connection = await mysql.createConnection({
      host: endpoint,
      user: username,
      password: password,
      multipleStatements: true,
      database: "HogwartsDb",
    });

    await connection.execute(sqlScript);
    return { Status: "SUCCESS" };
  } catch (error) {
    console.error("Error executing SQL:", error);
    return { Status: "FAILED", Reason: JSON.stringify(error) };
  }
};
