# Dev Launcher

A universal Electron desktop app for developers who run multiple backend and frontend services locally. Add any combination of .NET, Spring Boot, Ktor, Next.js, React, Node.js, Express, or Nest.js projects, organize them into tabs (workspaces), and start/stop them all from one UI — with a shared terminal dock showing color-coded output.

## Features

- **Fully dynamic** — add workspaces (tabs) and projects through the built-in UI; nothing is hardcoded
- **8 project types** — .NET (C#), Spring Boot (Java), Ktor (Kotlin), Next.js, React, Node.js, Express, Nest.js
- **Per-project config** — name, path, port, run command override, build command, environment variables
- **Color-coded terminal** — orange = launching/building, green = healthy, red = stopped/crashed
- **Port cleanup** — kills orphan PIDs on a port before every start, and sweeps again on stop
- **Persistent SQLite database** — workspaces and projects survive restarts (stored in OS user-data, never in the repo)
- **Strategy-based process spawning** — each project type has its own spawn logic (auto `npm install`, `gradlew` detection, etc.)

## Supported project types

| Type | Default run command | Default port |
|---|---|---|
| `.NET` (C# / ASP.NET Core) | `dotnet run` | — |
| `Spring Boot` | `./gradlew bootRun` or `./mvnw spring-boot:run` | 8080 |
| `Ktor` | `./gradlew run` | 8080 |
| `Next.js` | `npm run dev` | 3000 |
| `React` (Vite / CRA) | `npm run dev` | 5173 |
| `Node.js` | `npm start` | — |
| `Express` | `npm start` | — |
| `Nest.js` | `npm run start:dev` | 3000 |

All run commands can be overridden per project.

## Getting started

### Prerequisites

- Node.js 18+
- npm 9+
- For .NET projects: .NET SDK
- For Spring Boot / Ktor: JDK 17+ and Gradle or Maven
- For Node projects: Node.js (the launcher auto-runs `npm install` when `node_modules` is missing)

### Run in development

```bash
npm install       # also rebuilds better-sqlite3 for your Electron version
npm run dev
```

### Build a distributable

```bash
npm run package   # Windows: creates .exe under release/
```

For macOS/Linux, change the `electron-builder` target in `package.json`.

## Adding your projects

1. Launch the app
2. Click **⚙ Manage** in the top-right
3. Add a **workspace** (a named tab, e.g. "Backend", "Frontend")
4. Add **projects** to the workspace — pick the type, set the path (Browse button), port, and run command
5. Close the dialog — your projects appear as columns immediately

Your configuration is stored in a local SQLite database inside your OS user-data directory and is **never committed to git**.

## Data storage

The database lives at:

| OS | Path |
|---|---|
| Windows | `%APPDATA%\Dev Launcher\launcher.db` |
| macOS | `~/Library/Application Support/Dev Launcher/launcher.db` |
| Linux | `~/.config/Dev Launcher/launcher.db` |

This path is outside the project directory and is ignored by git.

## Architecture

```
src/
├── shared/types.ts              — shared TypeScript types (no runtime code)
├── main/
│   ├── db/
│   │   ├── database.ts          — SQLite init + schema migrations (better-sqlite3)
│   │   ├── WorkspaceRepository.ts
│   │   └── ProjectRepository.ts
│   ├── process/
│   │   ├── IProcessStrategy.ts  — strategy interface
│   │   ├── StrategyRegistry.ts  — maps ProjectType → strategy
│   │   └── strategies/          — one file per project type
│   ├── ipc/
│   │   ├── workspaces.ts        — CRUD IPC handlers
│   │   └── services.ts          — start/stop/kill/status IPC handlers
│   ├── process-manager.ts       — generic process spawner + log/exit events
│   └── port-cleanup.ts          — netstat + taskkill (Windows); lsof + kill (Unix)
├── preload/index.ts             — contextBridge: exposes window.launcher API
└── renderer/src/
    ├── App.tsx
    ├── hooks/
    │   ├── useWorkspaces.ts     — workspace + project state (DB-driven)
    │   └── useTerminals.ts      — xterm.js terminal lifecycle
    └── components/
        ├── WorkspaceManager.tsx — full CRUD settings dialog
        ├── WorkspaceTabs.tsx
        ├── ServiceColumn.tsx
        ├── TerminalDock.tsx
        ├── RunStopButton.tsx
        └── StatusBadge.tsx
```

## Adding a new project type

1. Create `src/main/process/strategies/MyTypeStrategy.ts` implementing `IProcessStrategy`
2. Register it in `src/main/process/StrategyRegistry.ts`
3. Add the type literal to `ProjectType` in `src/shared/types.ts`
4. Add a label to `PROJECT_TYPE_LABELS` in the same file

## Roadmap

- Mobile: build APK / IPA / bundle via Flutter, React Native, native Android/iOS
- Start-all / stop-all per workspace
- Dependency ordering between services
- Resizable terminal dock
- Import/export workspace config (portable JSON, no paths — paths stay local)

## License

MIT
