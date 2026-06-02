import { db } from "./connection";
import { sql } from "drizzle-orm";

async function clean() {
  console.log("Dropping and recreating public schema...");
  await db.execute(sql.raw(`DROP SCHEMA public CASCADE; CREATE SCHEMA public;`));
  console.log("Database schema cleaned successfully!");
  process.exit(0);
}

clean().catch((err) => {
  console.error("Clean failed:", err);
  process.exit(1);
});
