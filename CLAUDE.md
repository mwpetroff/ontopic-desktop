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

Fix: fully **unset/remove** the variable before launching — Electron checks whether the
variable is *present* in the environment, not whether it's truthy, so setting it to an
empty string is not enough and still triggers the run-as-node bug (confirmed by hitting
this exact failure while testing on 2026-08-31).

```powershell
Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
npm run dev
```

In bash (e.g. this project's Bash tool), the equivalent is `env -u ELECTRON_RUN_AS_NODE npm run dev`
— `ELECTRON_RUN_AS_NODE= npm run dev` (setting it to empty) does **not** work.

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

## Client-side Vite HMR is not reliable enough to trust for verification

Editing a plain `.ts` utility module (no React component export — e.g. `src/lib/*.ts`) in a
long-running dev session sometimes does **not** propagate via hot-reload the way editing a
`.tsx` page component does. React Fast Refresh needs an "accept boundary" (a component) to
re-render from; a lib module with no such boundary can get silently skipped or only partially
applied, especially after many hot-reloads have already happened in the same session.

Confirmed symptom: a demo script's dialogue text was edited and the dev server logged a normal
`hmr update` line, but the already-open window kept running the *old* text for a while after —
confirmed by checking what the Vite dev server itself was serving (`curl localhost:5173/src/...`
showed the new content) versus what the running app actually used (still old). The fix that
actually worked was a full restart (kill the Electron + node process tree, relaunch `npm run
dev`), not another edit-and-wait cycle.

Rule of thumb: after editing a non-component `.ts` file, don't assume the change is live just
because an `hmr update` log line appeared — if you need to be *certain* (verifying a fix, not
just iterating), do a full restart rather than trusting HMR.

---

## jsPDF's `doc.save()` writes a real file when there's no browser to download to

Under Node/jsdom (e.g. a vitest test), `jsPDF`'s `save()` falls back to writing the PDF to disk
via `fs` at whatever relative path you passed, since there's no real `<a download>` mechanism to
hand it to. A naive test that calls `exportSessionPdf(...)` will litter the repo root with a
generated `.pdf` file on every run. `save()` is assigned per-instance inside jsPDF's constructor,
not on `jsPDF.prototype`, so `vi.spyOn(jsPDF.prototype, "save")` silently fails to mock it (spy
just isn't found, no error, no effect) — subclassing via `vi.mock("jspdf", ...)` didn't reliably
take effect either. The pattern that works: compute the expected filename with the same
`buildExportFilename()` the export code uses, and delete it in an `afterAll` (same shape as
`tests/setup.ts`'s temp-SQLite-file cleanup).

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

The OpenAI API key is stored in the **OS keychain** via Electron `safeStorage` when set
through the Studio Settings page. Do **not** revert to `electron-store` or plaintext
storage — safeStorage is encrypted at rest and is the correct approach.

For development, a `.env` file is also supported (see `.env.example`). `electron/main.js`
reads `.env` before spawning the server; the server also reads it via
`import "dotenv/config"` as a fallback when running standalone (`npm run server`).

Precedence: safeStorage (UI-set key) > `.env` file.

---

## Single-instance lock

`app.requestSingleInstanceLock()` in `electron/main.js` ensures only one app process runs
at a time. When a second instance launches, it forwards its argv to the first via the
`second-instance` event and quits immediately.

Do not remove or conditionalize this lock — without it, two Electron windows can race for
port 3000 and leave orphaned server processes.

---

## Role-driven feature flags — never use user-toggled features

AI features are controlled server-side by `featuresForRole()` in `server/constants.ts`,
not by user-facing toggles. The function maps each `hostRole` string to a `FeatureFlags`
object. `server/routes.ts` calls it on every analysis request and merges it over any
caller-supplied flags so the server always wins.

```ts
// server/constants.ts
export function featuresForRole(role: string, salesMethodology?: string | null): FeatureFlags
```

Role → features:
- `host` (SA) → `actionItems`, `followUpQuestions`, `similarProjects`, **`competitorMentions`**
- `engineer` (SE) → base only
- `producer` (PM) → base + **`timelineSignals`**, **`riskFlags`**
- `correspondent` (BA) → base + **`requirements`**, **`painPoints`**
- `account-executive` (AE) → base + **`bantTracking`**, **`methodologyTracking`** (only when `salesMethodology` is set)

Do **not** add `useState` toggles for features in the dashboard. The correct pattern is
to let the role determine which panels render.

---

## Adding new session columns — always create a Drizzle migration AND an `ensureColumn()` call

When adding columns to the `sessions` table in `shared/schema.ts`, you must also:

1. Create `drizzle/<idx>_<tag>.sql` with the `ALTER TABLE` statements.
2. Add an entry to `drizzle/meta/_journal.json` with the next sequential `idx`.
3. Add an `ensureColumn("sessions", "<column>", "<type>")` call in `server/db.ts`, next to
   the existing ones.

Step 3 is easy to skip and **the tests will not catch it** — `tests/setup.ts` runs `migrate()`
against a brand-new database where every migration applies cleanly in order, so it always
passes. The real app database is a different story: it predates migration tracking (it was
originally seeded via `drizzle-kit push`, so there is no `__drizzle_migrations` table). Every
launch, `migrate()` replays *all* migration files from `0000` — hits an "already exists"
collision on an early one, throws, and `server/db.ts`'s catch-all logs a warning and gives up
for that call. Your new migration file, even though it's syntactically fine and would apply
standalone, **never runs** on that database because `migrate()` aborted before reaching it.
Symptom: `SqliteError: table sessions has no column named <your_column>` the first time a
session write touches it, discovered only by actually running the app against real user data,
not by `npm test`. `ensureColumn()` is the defense-in-depth that makes the column show up
regardless of whether `migrate()` gets that far.
