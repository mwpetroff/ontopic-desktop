import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import path from "path";
import fs from "fs";
import * as schema from "@shared/schema";

// Store the database in the user's app data directory so it persists across updates.
// Falls back to the project root in development.
function getDbPath(): string {
  const appData =
    process.env.APPDATA ||
    (process.platform === "darwin"
      ? path.join(process.env.HOME!, "Library", "Application Support")
      : path.join(process.env.HOME!, ".local", "share"));
  const dir = path.join(appData, "OnTopic");
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, "database.sqlite");
}

const dbPath = process.env.DATABASE_PATH || getDbPath();
console.log(`[db] SQLite database at: ${dbPath}`);

const sqlite = new Database(dbPath);

// Enable WAL mode for better concurrent read performance.
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite, { schema });

// Apply any pending migrations (creates tables on first launch, no-op if already up-to-date).
const migrationsFolder = path.resolve(__dirname, "../drizzle");
try {
  migrate(db, { migrationsFolder });
  console.log("[db] Migrations applied.");
} catch (err: any) {
  // "already exists" on a table/column/index means the DB was initialised via drizzle-kit
  // push (no __drizzle_migrations tracking table), so migrate() tries to re-create objects
  // that are already there. This is safe to ignore.
  // Drizzle wraps the underlying SQLite error, so check both the outer message and its cause.
  const combined = `${err?.message ?? ""} ${err?.cause?.message ?? ""}`;
  const isAlreadyExists = /table .* already exists|column .* already exists|index .* already exists/i.test(combined);
  if (isAlreadyExists) {
    console.warn("[db] Migration: some schema objects already exist (re-migration), continuing.");
  } else {
    console.error("[db] Migration failed:", err?.message ?? err);
    throw err;
  }
}
