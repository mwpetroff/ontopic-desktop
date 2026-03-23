import { defineConfig } from "drizzle-kit";
import path from "path";
import fs from "fs";

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

export default defineConfig({
  dialect: "sqlite",
  schema: "./shared/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DATABASE_PATH || getDbPath(),
  },
});
