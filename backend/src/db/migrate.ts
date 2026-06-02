import { db } from "./connection";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Executes pending database migration SQL scripts located in the migrations directory.
 * Connects to the database configured via the DATABASE_URL environment variable.
 * Used during CI/CD pipelines or deployment steps (such as on AWS ECS/CodeDeploy/Elastic Beanstalk).
 */
async function runMigrations() {
  console.log("🚀 Running database migrations...");
  try {
    await migrate(db, {
      migrationsFolder: path.join(__dirname, "migrations"),
    });
    console.log("✅ Database migrations completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Database migrations failed:", error);
    process.exit(1);
  }
}

runMigrations();
