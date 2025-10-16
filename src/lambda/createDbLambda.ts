import getDb from "../util/dbConnector";

const DB_HOST = process.env.DB_HOST || "";
const DB_SECRET = process.env.DB_SECRET || "";

exports.handler = async (event: any) => {
  // all this local environment stuff is so I can re-run this lamdba if I need to for some reason
  let host = event?.ResourceProperties?.endpoint ?? DB_HOST;
  let sqlScript =
    event?.ResourceProperties?.sqlScript ??
    `
    CREATE TABLE IF NOT EXISTS Notifications (
      id CHAR(36) PRIMARY KEY,
      recipient VARCHAR(255) NOT NULL,
      message VARCHAR(255) NOT NULL,
      status VARCHAR(255) NOT NULL,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;
  let secret = event?.ResourceProperties?.secretArn ?? DB_SECRET;

  try {
    const db = await getDb(host, secret);
    await db.execute(sqlScript);
    console.log("Successfully created database");
    await db.end();
    return { Status: "SUCCESS" };
  } catch (error) {
    console.error("Error executing SQL:", error);
    return { Status: "FAILED", Reason: JSON.stringify(error) };
  }
};
