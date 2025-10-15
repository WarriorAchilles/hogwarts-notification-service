import { SecretsManager } from "aws-sdk";
import * as mysql from "mysql";

exports.handler = async (event: any) => {
  const secretsManager = new SecretsManager();
  const { secretArn, endpoint, sqlScript } = event.ResourceProperties;

  try {
    const secretData = await secretsManager
      .getSecretValue({ SecretId: secretArn })
      .promise();
    const { username, password } = JSON.parse(secretData.SecretString!);

    const connection = mysql.createConnection({
      host: endpoint,
      user: username,
      password: password,
      multipleStatements: true,
    });

    await new Promise((resolve, reject) => {
      connection.connect((err) => {
        if (err) reject(err);
        resolve(null);
      });
    });

    await new Promise((resolve, reject) => {
      connection.query(sqlScript, (err, results) => {
        if (err) reject(err);
        resolve(results);
      });
    });

    connection.end();
    return { Status: "SUCCESS" };
  } catch (error) {
    console.error("Error executing SQL:", error);
    return { Status: "FAILED", Reason: JSON.stringify(error) };
  }
};
