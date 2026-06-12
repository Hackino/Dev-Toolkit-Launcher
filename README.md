<div align="center">

# Dev Launcher

**A desktop command center for everything you run locally — backend services, web apps, and mobile builds — in one glassmorphic UI.**

[![Electron](https://img.shields.io/badge/Electron-33-47848F?logo=electron&logoColor=white)](https://www.electronjs.org/)
[![React](https://img.shields.io/badge/React-18-20232A?logo=react&logoColor=61DAFB)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![electron-vite](https://img.shields.io/badge/electron--vite-2-646CFF?logo=vite&logoColor=white)](https://electron-vite.org/)
[![SQLite](https://img.shields.io/badge/SQLite-better--sqlite3-003B57?logo=sqlite&logoColor=white)](https://github.com/WiseLibs/better-sqlite3)
[![Status](https://img.shields.io/badge/status-work%20in%20progress-orange)](#-work-in-progress)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

</div>

---

> ## 🚧 Work in progress
>
> **Dev Launcher is under active development and is _not_ production-ready.** Expect
> breaking changes, incomplete features, rough edges, and bugs. Build commands and
> platform integrations may not work in every environment yet. Use it for
> experimentation only, and **always verify generated build/release commands before
> running them against real projects**. Pin a commit if you depend on current behavior.

---

Dev Launcher turns the daily juggling act — `cd` into a repo, remember the run command, free the port, tail the logs, repeat for every service — into a single dashboard. Backend and web services start and stop with one click and stream to a shared terminal. Mobile projects (Android, iOS, Flutter, React Native, Compose Multiplatform) get a full build / run / release control panel with dynamic build configurations, flavor auto-detection, and drag-and-drop Firebase / keystore setup.

Everything is configured through the UI and persisted to a local SQLite database — **nothing is hardcoded**.

## Table of contents

- [Highlights](#highlights)
- [Supported project types](#supported-project-types)
- [Mobile development](#mobile-development)
- [Tech stack](#tech-stack)
- [Architecture](#architecture)
- [Project structure](#project-structure)
- [Getting started](#getting-started)
- [Usage](#usage)
- [Security & privacy](#security--privacy)
- [Data storage](#data-storage)
- [Scripts](#scripts)
- [Contributing](#contributing)
- [License](#license)

## Highlights

### Backend & web
- **8 project types** out of the box — .NET, Spring Boot, Ktor, Next.js, React, Node.js, Express, Nest.js.
- **One-click run / stop / kill-port** with orphan-PID cleanup before every start and a sweep on stop.
- **Run profiles** — multiple named run configurations per project (e.g. *Development*, *Staging*) each with its own command, port, and URL.
- **Color-coded status** — orange (launching / building), green (healthy), red (stopped / crashed).

### Mobile
- **5 platforms** — Android Native, iOS Native, Flutter, React Native, Compose Multiplatform (KMP).
- **Fully dynamic build configs** — add / remove Gradle props & flags, Xcode build settings, Flutter dart-defines, and env vars from the UI; never touch code to change a build.
- **Per-config R8 / ProGuard** with custom rule files, plus multiple Flutter entry points.
- **Build-variant auto-detection** — parse `build.gradle`, `lib/main*.dart`, and `.xcscheme` files instantly, with an optional deep scan via `./gradlew tasks` / `xcodebuild -list`.
- **Drag-and-drop Firebase & keystores** — drop `google-services.json`, `GoogleService-Info.plist`, or a `.jks` / `.keystore`; it's validated and placed in the right location. Autodetect finds existing ones.
- **Multi-platform fan-out** — Flutter / RN / KMP projects spread into **one column per platform** (Android · iOS · Desktop · Web) instead of a dropdown.
- **Device-aware run / install** — each column has a live device/emulator picker (`adb` · `simctl` · `flutter`); **Run** is gated on a selected target.
- **Install to a device** — pick any `.apk` or `.aab` from disk; App Bundles are converted and installed via **bundletool**, fetched automatically on first use.
- **Version management** — read & bump version name / code / build number across `build.gradle`, `Info.plist`, and `pubspec.yaml` (with `.bak` backups).

### Platform
- **Shared terminal dock** powered by xterm — every service and build streams to a tabbed, status-aware terminal.
- **Persistent SQLite store** with a versioned migration system; lives in the OS user-data dir, never in the repo.
- **Glassmorphism UI** — frosted surfaces, depth, platform-tinted accents, reduced-motion aware.
- **Type-safe end to end** — strict TypeScript across main, preload, and renderer.

## Supported project types

| Type | Default run command | Default port |
|---|---|---|
| .NET (C# / ASP.NET Core) | `dotnet run` | — |
| Spring Boot (Java) | `./gradlew bootRun` / `./mvnw spring-boot:run` | 8080 |
| Ktor (Kotlin) | `./gradlew run` | 8080 |
| Next.js | `npm run dev` | 3000 |
| React (Vite / CRA) | `npm run dev` | 5173 |
| Node.js | `npm start` | — |
| Express | `npm start` | — |
| Nest.js | `npm run start:dev` | 3000 |

Every command, port, and environment variable is overridable per project and per run profile.

## Mobile development

| Platform | Build | Run | Bundle / Release |
|---|---|---|---|
| **Android Native** | `gradlew assemble<Variant>` | install + `adb` launch (device-gated) | `bundle<Variant>` (selected variant) + injected signing |
| **iOS Native** *(macOS)* | `xcodebuild build` | simulator / device | archive + export `.ipa` |
| **Flutter** | `flutter build apk / ipa / web / <desktop>` | `flutter run -d <device>` | `appbundle` / `ipa` / `web` |
| **React Native** | gradle (Android) · `build-ios` (iOS) | `run-android` / `run-ios` | `bundleRelease` / `build-ios --mode Release` |
| **Compose Multiplatform** | gradle per target | `desktopRun` / android / ios / web | `bundleRelease` (per target) |

The core extensibility primitive is a **dynamic build flag** — a typed, toggleable `{ kind, key, value }` entry. Strategies assemble the final CLI command from the user's flags at build time, so any Gradle property, Xcode setting, or dart-define can be added without code changes. iOS actions are guarded at three layers and shown disabled (not hidden) on non-macOS hosts.

**Bundle & install.** The Android **Bundle** action builds an `.aab` for the variant currently selected in the column's dropdown (flavor + build type), with signing flags injected from your keystore config. **Install** opens a file picker: an `.apk` goes straight to the device via `adb install -r`, while an `.aab` is run through **bundletool** (`build-apks --mode=universal` → `install-apks`), which is downloaded to the app's data dir the first time it's needed. Both require a device selected in the column.

## Tech stack

| Layer | Technology |
|---|---|
| Shell | Electron 33 (main + preload + renderer, context isolation) |
| Bundler | electron-vite (Vite 5, Rollup) |
| UI | React 18, TypeScript 5, hand-rolled glassmorphism CSS |
| Terminal | `@xterm/xterm` + fit addon |
| Persistence | `better-sqlite3` with a versioned migration runner |
| Process control | Node `child_process` + `tree-kill` |
| Toolchain integration | `gradle` / `gradlew`, `xcodebuild` / `xcrun simctl`, `flutter`, `adb`, `bundletool` (auto-fetched) |

## Architecture

Dev Launcher is built as a **feature-based clean architecture**. Dependencies point inward only, and **features never call each other** — shared behavior lives one layer down.

```
core/          Domain models + ports (interfaces). Zero dependencies.
capabilities/  Reusable building blocks behind interfaces: process, persistence,
               gradle, signing, build-flags, devices, detection, versioning, assets.
features/      ONE module per language / runtime. Depend on core + capabilities,
               never on each other.
app/           Composition root: feature registry, application services, IPC.
```

**How "features can't call each other" is satisfied.** Cross-cutting concerns like *Firebase integration* and *Gradle usage* are **capabilities**, not features. When the Android feature and the Compose Multiplatform feature both need Gradle, they each depend *downward* on `capabilities/gradle` — never sideways on one another. This is the Dependency-Inversion + Shared-Kernel pattern. The **feature registry** is the only module that knows the full set of features, so adding a language is *add a folder + one registry line* (Open/Closed).

The same layering is mirrored in the renderer: `capabilities/` (shared UI widgets), `features/` (per-language settings + registry), `ui/` (presentational), and `app/` (composition).

**SOLID in practice**
- **S** — repositories are pure persistence; feature defaults are resolved by an application service.
- **O** — new language = new feature module; no switch statements to edit.
- **L / I** — every feature implements the same small `LanguageFeature` / `MobileCommands` ports.
- **D** — inner layers define interfaces; outer layers implement them.

## Project structure

```
src/
├── shared/                     # cross-process contracts (the shared kernel)
│   ├── types.ts                #   all DTOs + the preload API surface
│   └── category.ts             #   backend vs mobile helpers
│
├── main/                       # Electron main process
│   ├── core/ports.ts           #   LanguageFeature / MobileCommands contracts
│   ├── capabilities/
│   │   ├── process/            #   spawn · stream · stop · port cleanup
│   │   ├── persistence/        #   SQLite connection + repositories
│   │   ├── gradle/             #   gradlew resolution
│   │   ├── signing/            #   Android signing flags (env-var only)
│   │   ├── buildflags/         #   dynamic CLI flag resolver
│   │   ├── devices/            #   adb / simctl / flutter device listing
│   │   ├── detection/          #   build-variant / flavor detection
│   │   ├── versioning/         #   gradle / plist / pubspec version files
│   │   └── assets/             #   firebase + keystore detect · validate · import
│   ├── features/
│   │   ├── backend/            #   dotnet · node · springBoot · ktor
│   │   ├── mobile/             #   android · ios · flutter · reactNative · composeMultiplatform
│   │   └── registry.ts         #   composition root
│   ├── app/
│   │   ├── ipc/                #   services · workspaces · mobile
│   │   └── projectService.ts   #   applies feature defaults
│   └── index.ts                #   Electron entry
│
├── preload/index.ts            # typed contextBridge API
│
└── renderer/src/               # React app (mirrors the layering)
    ├── capabilities/           #   build-config editor · variant detector · firebase ·
    │                           #   version panel · flags · logos · file-drop field
    ├── features/               #   per-language settings · registry · column targets
    ├── ui/                     #   columns · badges · terminal dock · tabs
    ├── app/                    #   WorkspaceManager · MobileFormPanel
    ├── hooks/                  #   useWorkspaces · useTerminals · useDevices · useMobile
    ├── App.tsx
    └── styles.css
```

## Getting started

### Prerequisites

- **Node.js 18+** and **npm 9+**
- Per-stack toolchains (only for the project types you use):
  - .NET SDK · JDK 17+ with Gradle/Maven (Spring Boot, Ktor, Android, KMP)
  - Android SDK + `adb` (Android, RN, Flutter, KMP)
  - Xcode + command-line tools (iOS — macOS only)
  - Flutter SDK (Flutter)

### Install & run

```bash
npm install        # also rebuilds better-sqlite3 for your Electron version
npm run dev        # launch in development with hot reload
```

### Build a distributable

```bash
npm run build      # type-check-clean production bundle into out/
npm run package    # Windows installer + portable into release/
```

`package.json` already configures `electron-builder` targets for **Windows** (nsis, portable), **macOS** (dmg, zip), and **Linux** (AppImage, deb) — adjust the `--win` / `--mac` / `--linux` flag in the `package` script for your platform.

## Usage

### Add a backend / web service
1. Click **⚙ Manage** → add a **workspace** (a named tab, e.g. *Backend*).
2. **+ Add Project** → keep the **Backend / Web** tab → pick a type, browse to the path, set the port and run command.
3. Optionally add **run profiles** for alternate configurations.
4. Back on the dashboard: **▶ Run** / **■ Stop** / **Kill Port** — output streams to the terminal dock.

### Add a mobile project
1. **+ Add Project** → switch to the **Mobile** tab → pick a platform.
2. Set name & path, then move through the platform tabs:
   - **Build configs / entry points** — click **⚡ Detect** to parse them from the project (or **Deep scan** for ground truth), or add them manually.
   - **Signing** — drop your keystore onto the drop zone; passwords are referenced by **env-var name only**.
   - **Firebase** — drop `google-services.json` / `GoogleService-Info.plist`; it's validated and placed correctly (desktop config supported for KMP).
3. On the dashboard, multi-platform projects appear as **one column per platform**, each with its own:
   - **Variant + device pickers** — choose the build config / entry point and the target device or emulator.
   - **Build / Run / Bundle (Android) or Archive (iOS) / Clean** — Run and Install require a selected device.
   - **Install** — pick an `.apk` or `.aab`; bundles are installed via bundletool automatically.
   - Flutter columns also expose **`pub get`** and **Doctor**.

## Security & privacy

- **No secrets are ever stored.** Signing credentials are kept as **environment-variable names**, resolved from `process.env` only at release time, and **redacted** in the displayed command.
- **Local-only data.** Workspaces, projects, and mobile configs live in a SQLite file in the OS user-data directory — never committed to the repo.
- **Dropped files are validated** before import (JSON structure for `google-services.json`, plist keys for iOS, magic bytes for keystores).

## Data storage

The database lives outside the project directory and is ignored by git:

| OS | Path |
|---|---|
| Windows | `%APPDATA%\Dev Launcher\launcher.db` |
| macOS | `~/Library/Application Support/Dev Launcher/launcher.db` |
| Linux | `~/.config/Dev Launcher/launcher.db` |

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Launch with hot reload |
| `npm run build` | Production bundle (`out/`) |
| `npm run package` | Build + create installers (`release/`) |
| `npm run typecheck` | Type-check main + renderer (`typecheck:node` / `typecheck:web`) |
| `npm run rebuild` | Rebuild `better-sqlite3` for the current Electron |

## Contributing

Issues and pull requests are welcome. To add a new language / runtime:

1. Create a feature module under `src/main/features/<backend|mobile>/`.
2. Implement the `LanguageFeature` (and `MobileCommands` for mobile) port, composing existing capabilities.
3. Register it in `src/main/features/registry.ts`.
4. Add renderer presentation / settings under `src/renderer/src/features/` and the renderer registry.

Run `npm run typecheck` before opening a PR — both configs must be clean.

## License

[MIT](./LICENSE) © Dev Launcher contributors
