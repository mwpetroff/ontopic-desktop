# OnTopic Desktop — IT Security Policy Requirements

## Root Cause

Electron uses **Mojo IPC** (Chromium's inter-process communication system) to communicate
between its main process and renderer (UI) processes. On Windows, Mojo creates a named pipe
of the form `\\.\pipe\mojo.*` at startup. If the OS or a security product blocks that named
pipe creation, Electron immediately crashes with:

```
FATAL:platform_channel.cc(83) Check failed: Access is denied. (0x5)
```

This is not a bug in the application — it is a security policy enforcement issue.

---

## What Needs to Be Allowed

The following capabilities must be permitted for **both** the dev and production scenarios.

### 1. Named Pipe Creation (Critical)

Electron creates named pipes for its internal IPC channel.

| Detail | Value |
|---|---|
| Pipe pattern | `\\.\pipe\mojo.*` |
| Pipe pattern | `\\.\pipe\chrome.*` |
| Direction | Created by the Electron main process, connected to by renderer/GPU processes |
| Why | Without this, the app crashes immediately at startup |

**How to allow** (Group Policy / WDAC / AppLocker):
- Permit named pipe creation for the Electron executable paths listed below
- In CrowdStrike Falcon or similar EDR: add a named pipe exclusion for `mojo.*` and `chrome.*` originating from the allowed executables

---

### 2. Child Process Spawning

Electron spawns multiple child processes at startup. All must be permitted:

| Child Process | Purpose |
|---|---|
| `electron.exe --type=renderer` | Renders the React UI (Chromium renderer) |
| `electron.exe --type=gpu-process` | GPU compositing |
| `electron.exe --type=utility` | Network service, storage |
| `node.exe` (via `cmd.exe /c tsx.cmd`) | Express backend server on port 3000 |

---

### 3. Local Network Access

| Connection | Port | Purpose |
|---|---|---|
| `127.0.0.1:3000` | TCP | Main process → Express REST API |
| `127.0.0.1:5173` | TCP (dev only) | Main process → Vite dev server |
| `api.openai.com` | TCP 443 | Whisper transcription + GPT analysis |

---

### 4. Filesystem Paths

| Path | Access | Purpose |
|---|---|---|
| `%APPDATA%\OnTopic\` | Read/Write | Database, logs, API key config |
| `%APPDATA%\OnTopic\database.sqlite` | Read/Write | SQLite session data |
| `%APPDATA%\OnTopic\server.log` | Write | Express server log |
| `%APPDATA%\OnTopic\.env` | Read | OpenAI API key (production) |
| `%LOCALAPPDATA%\electron-store\` | Read/Write | electron-store settings |

---

## Dev (Non-Packaged) Scenario

In development, Electron runs directly from the npm package — the binary is **unsigned**.

### Executable Paths to Whitelist

```
C:\Users\<username>\Projects\ontopic-desktop\node_modules\electron\dist\electron.exe
C:\Users\<username>\Projects\ontopic-desktop\node_modules\electron\dist\*.dll
```

> Because the path includes a user's personal project directory, AppLocker/WDAC
> **publisher rules** cannot be used (the binary is not signed). A **path rule** is required.

### Binary Details

| Property | Value |
|---|---|
| File | `node_modules\electron\dist\electron.exe` |
| Version | 31.7.7 |
| Publisher | GitHub, Inc. |
| Code Signing | **Not signed** (upstream Electron build — no certificate) |
| SHA-256 | Run: `Get-FileHash .\node_modules\electron\dist\electron.exe` |

### Required Policy Exceptions (Dev)

| Policy Type | What to Configure |
|---|---|
| **AppLocker** | Add path rule: allow `%OSDRIVE%\Users\*\Projects\*\node_modules\electron\dist\electron.exe` |
| **WDAC** | Add unsigned file exception for the electron.exe SHA-256 hash, or allow by path |
| **CrowdStrike / EDR** | Add process exclusion for the `electron.exe` path; allow named pipe creation `mojo.*` |
| **Windows Defender** | Add folder exclusion: `node_modules\electron\dist\` |
| **Network firewall** | Allow outbound TCP 443 from `electron.exe` to `api.openai.com` |

---

## Prod (Packaged) Scenario

In production, the app is built with `electron-builder` into a signed NSIS installer.
The installed binary lives in `Program Files` and **must be code-signed** before IT
whitelisting is practical.

> **Note:** Code signing is planned for Phase 7 of the roadmap. Until it is complete,
> production deployment on managed machines faces the same unsigned-binary restriction as dev.

### Executable Paths (After Install)

```
C:\Program Files\OnTopic\OnTopic.exe
C:\Program Files\OnTopic\*.dll
```

### Required Policy Exceptions (Prod, once signed)

| Policy Type | What to Configure |
|---|---|
| **AppLocker** | Publisher rule: allow executables signed by `<your code signing certificate CN>` with product name `OnTopic` |
| **WDAC** | Publisher rule using the certificate's issuer + subject from the code signing cert |
| **CrowdStrike / EDR** | Add process exclusion by publisher or by path `C:\Program Files\OnTopic\OnTopic.exe`; allow named pipe `mojo.*` and `chrome.*` |
| **Windows Defender** | Add folder exclusion: `C:\Program Files\OnTopic\` |
| **Network firewall** | Allow outbound TCP 443 from `OnTopic.exe` to `api.openai.com` |
| **NSIS Installer** | The installer (`OnTopicSetup.exe`) itself must also be signed and whitelisted to run |

---

## Quick Verification Steps

After policy changes are applied, verify with:

```powershell
# 1. Confirm named pipe creation is not blocked
# Run the app, then in a second terminal:
Get-ChildItem \\.\pipe\ | Where-Object { $_.Name -like "mojo*" }
# Should show at least one mojo.* pipe entry while the app is running

# 2. Confirm Electron child processes are spawning
Get-Process | Where-Object { $_.Name -eq "electron" } | Select-Object Id, StartTime
# Should show 3–5 electron.exe processes

# 3. Check Event Viewer for blocks
# Application and Services Logs > Microsoft > Windows > AppLocker > EXE and DLL
# or WDAC audit log — look for block events around the time of launch
```

---

## Interim Workaround (Before IT Approval)

While waiting for policy changes, the app can be run in **browser-only mode**:

```powershell
# Terminal 1 — start the backend
cd C:\Users\<username>\Projects\ontopic-desktop
npm run server

# Terminal 2 — start the frontend
npx vite
```

Then open `http://localhost:5173` in any browser. All features work except:
- System audio capture (mic + speaker loopback — requires Electron IPC)
- Tray icon
- Setup wizard

This is useful for demonstrating and testing the UI and all API-backed features.

---

## Summary for IT Ticket

> **Application:** OnTopic Desktop (Electron 31, based on Chromium)
>
> **Issue:** Corporate security policy is blocking Electron's Mojo IPC named pipe creation
> (`\\.\pipe\mojo.*`), causing an immediate crash at startup with error code 0x5
> (Access Denied) from `platform_channel.cc`.
>
> **Requests:**
> 1. Allow execution of `electron.exe` from the dev path (path rule) and eventually from
>    `C:\Program Files\OnTopic\` (publisher rule, once code-signed)
> 2. Allow named pipe creation matching `\\.\pipe\mojo.*` and `\\.\pipe\chrome.*` from
>    those executables
> 3. Allow child process spawning from `electron.exe`
> 4. Allow outbound HTTPS to `api.openai.com`
>
> **Risk:** Low. Electron is an open-source Chromium-based framework maintained by GitHub (Microsoft).
> The app runs entirely on the local machine — no data leaves except via the user's own
> OpenAI API key. No elevated privileges are required at runtime.
