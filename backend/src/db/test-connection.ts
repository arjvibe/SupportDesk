import postgres from "postgres";

async function tryConnect(url: string) {
  const sql = postgres(url);
  try {
    const res = await sql`SELECT datname FROM pg_database WHERE datname = 'postgres'`;
    return { success: true, sql, exists: res.length > 0 };
  } catch (err: any) {
    await sql.end();
    return { success: false, error: err.message };
  }
}

async function main() {
  const urls = [
    "postgres://postgres:Welcome@123@localhost:5432/postgres",
    "postgres://postgres@localhost:5432/postgres",
    "postgres://postgres:root@localhost:5432/postgres",
    "postgres://postgres:admin@localhost:5432/postgres",
    "postgres://postgres:password@localhost:5432/postgres",
    "postgres://postgres:postgres@localhost:5432/postgres",
  ];

  let activeSql: postgres.Sql<{}> | null = null;
  let activeUrl: string | null = null;
  let dbExists = false;

  for (const url of urls) {
    console.log(`Trying connection: ${url.replace(/:[^@/]+@/, ":****@")}`);
    const res = await tryConnect(url);
    if (res.success && res.sql) {
      console.log("Connected successfully!");
      activeSql = res.sql;
      activeUrl = url;
      dbExists = res.exists;
      break;
    } else {
      console.log(`Failed: ${res.error}`);
    }
  }

  if (!activeSql || !activeUrl) {
    console.error("Could not connect to PostgreSQL with any credentials.");
    process.exit(1);
  }

  try {
    if (!dbExists) {
      console.log("Database 'aura_supportdesk' does not exist. Creating database...");
      await activeSql`CREATE DATABASE aura_supportdesk`;
      console.log("Database created successfully!");
    } else {
      console.log("Database 'aura_supportdesk' already exists.");
    }

    // Connect to the aura_supportdesk database to enable extensions
    const auraUrl = activeUrl.substring(0, activeUrl.lastIndexOf("/")) + "/aura_supportdesk";
    const auraSql = postgres(auraUrl);
    console.log("Enabling pgvector extension on aura_supportdesk...");
    await auraSql`CREATE EXTENSION IF NOT EXISTS "vector"`;
    console.log("pgvector extension enabled!");
    await auraSql.end();
    
    console.log(`Working connection: ${auraUrl}`);
  } catch (error: any) {
    console.error("Database check/create failed:", error.message);
  } finally {
    await activeSql.end();
    process.exit(0);
  }
}

main();
