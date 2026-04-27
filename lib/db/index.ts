// lib/db/index.ts
// Database connection using Drizzle ORM + Postgres

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// Singleton pattern for connection pooling in serverless
const globalForDb = globalThis as unknown as {
  connection: postgres.Sql | undefined;
};

// v8 fix: give a clear error if DATABASE_URL is missing (not a cryptic postgres error)
if (!process.env.DATABASE_URL) {
  throw new Error(
    "[NeuroFast] DATABASE_URL environment variable is not set. " +
    "Copy .env.example to .env.local and fill in the value."
  );
}

const connection =
  globalForDb.connection ??
  postgres(process.env.DATABASE_URL, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.connection = connection;
}

export const db = drizzle(connection, { schema });
export type DB = typeof db;
