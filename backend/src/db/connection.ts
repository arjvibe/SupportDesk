import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../schema";
import dotenv from "dotenv";

// Load environment variables from .env file
dotenv.config();

const connectionString = process.env.DATABASE_URL || "postgres://postgres:postgres@localhost:5432/aura_supportdesk";

// Setup pg-js client connection pool
const queryClient = postgres(connectionString, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
});

export const db = drizzle(queryClient, { schema });
export type DbClient = typeof db;
