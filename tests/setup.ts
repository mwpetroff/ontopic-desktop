/**
 * Vitest global setup — runs before every test file.
 *
 * Points DATABASE_PATH at a unique temp SQLite file and creates all tables
 * via the Drizzle migrator so tests run against an isolated, clean database.
 */
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import path from "path";
import os from "os";
import fs from "fs";

const testDbPath = path.join(os.tmpdir(), `ontopic-test-${process.pid}.sqlite`);

// Set before any server module is imported so server/db.ts picks up this path.
process.env.DATABASE_PATH = testDbPath;

// Create and migrate the test database immediately.
const sqlite = new Database(testDbPath);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");
const db = drizzle(sqlite);
migrate(db, { migrationsFolder: path.resolve(__dirname, "../drizzle") });
sqlite.close();

// Clean up the temp file after all tests complete.
afterAll(() => {
  if (fs.existsSync(testDbPath)) {
    try { fs.unlinkSync(testDbPath); } catch {}
  }
});
