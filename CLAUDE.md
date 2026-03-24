# OnTopic Desktop — AI Development Notes

## better-sqlite3 is synchronous — never use async callbacks in `db.transaction()`

`better-sqlite3` is a **synchronous** SQLite driver. Its `db.transaction()` method
explicitly rejects async callback functions at runtime:

```
TypeError: Transaction function cannot return a promise
```

**What breaks:**
```ts
// ❌ This throws at runtime — better-sqlite3 forbids async transaction callbacks
await db.transaction(async (tx) => {
  const rows = await tx.select()...
  await tx.update()...
});
```

**What works:**
```ts
// ✓ Drizzle's query builders are awaitable (they call .all()/.run() lazily via .then())
const [row] = await db.select().from(sessions).where(eq(sessions.id, id));
await db.update(sessions).set({ ... }).where(eq(sessions.id, id));
```

For a single-user desktop app, skipping a transaction and using sequential `await`'d
queries is fine. If atomicity is ever required, use `sqlite.transaction(() => { ... })`
(the raw `better-sqlite3` synchronous transaction API) — everything inside must be sync.

---

## Windows: do not set ELECTRON_RUN_AS_NODE in the dev shell

If `ELECTRON_RUN_AS_NODE=1` is set in the shell environment (common in some git bash / CI
setups), Electron runs as plain Node.js and never opens a window. Symptoms:
- `process.type` is `undefined` (should be `"browser"` in the main process)
- `require("electron")` returns the npm package path string instead of the built-in APIs
- `ipcMain` is `undefined` at runtime → `TypeError: Cannot read properties of undefined (reading 'handle')`

Fix: unset the variable before launching.
```powershell
$env:ELECTRON_RUN_AS_NODE = ""
npm run dev
```

---

## Windows: spawning .cmd wrappers requires cmd.exe /c

Node.js 20+ on Windows blocks `child_process.spawn()` for `.cmd` files without `shell: true`
(security change). For the server child process, use `cmd.exe /c tsx.cmd` explicitly:

```js
const spawnCmd  = process.platform === "win32" ? "cmd.exe" : tsxBin;
const spawnArgs = process.platform === "win32" ? ["/c", tsxBin + ".cmd", serverScript] : [serverScript];
```

---

## tsx does not hot-reload the server

The server is spawned as a child process via `tsx`. Changes to server files **only take
effect after a full process restart** (quit and relaunch Electron, or kill the ghost
process). Symptom: code changes appear to have no effect even after saving.

On Windows, `serverProcess.kill()` only kills the `.cmd` wrapper — the underlying
`node.exe` keeps running and holds port 3000. Use `taskkill /pid <pid> /T /F` to kill
the whole process tree (already handled in `electron/main.js` `before-quit`).

---

## Run tests after any `npm install`

`naudiodon` and its dependency `segfault-handler` must be rebuilt for Electron.
`better-sqlite3` must stay compiled for system Node (used by the server child process and
tests). The `postinstall` / `rebuild` scripts target `naudiodon,segfault-handler`. After
any `npm install`, run:

```
npm test
```

If `better-sqlite3` tests fail, it means the native module was accidentally rebuilt for
Electron. Re-run `npm rebuild better-sqlite3` to fix it.

---

## API key configuration

The OpenAI API key lives in a `.env` file (see `.env.example`), **not** in the UI.
`electron/main.js` reads it before spawning the server. The server also reads it via
`import "dotenv/config"` as a fallback when running standalone (`npm run server`).

Do not add UI settings fields for secrets — keep them in `.env`.
