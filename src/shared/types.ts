// Shared types between main and renderer. No runtime code.

// ─── Project types ──────────────────────────────────────────────────────────

export type ProjectType =
  | 'dotnet'       // C# / ASP.NET Core  (dotnet run)
  | 'spring-boot'  // Java Spring Boot   (mvnw/gradlew)
  | 'ktor'         // Kotlin Ktor        (gradlew run)
  | 'nextjs'       // Next.js            (npm run dev)
  | 'react'        // React (Vite/CRA)   (npm run dev)
  | 'nodejs'       // Plain Node.js      (node . / npm start)
  | 'express'      // Express.js         (npm start)
  | 'nestjs';      // Nest.js            (npm run start:dev)

export const PROJECT_TYPE_LABELS: Record<ProjectType, string> = {
  'dotnet':      '.NET',
  'spring-boot': 'Spring',
  'ktor':        'Ktor',
  'nextjs':      'Next.js',
  'react':       'React',
  'nodejs':      'Node',
  'express':     'Express',
  'nestjs':      'Nest.js',
};

export type TechTag = 'typescript' | 'javascript' | 'java' | 'kotlin' | 'csharp' | 'python' | 'docker';

export const TECH_TAG_LABELS: Record<TechTag, string> = {
  typescript: 'TypeScript',
  javascript: 'JavaScript',
  java:       'Java',
  kotlin:     'Kotlin',
  csharp:     'C#',
  python:     'Python',
  docker:     'Docker',
};

// ─── Data model ──────────────────────────────────────────────────────────────

export type WorkspaceConfig = {
  id: string;
  name: string;
  position: number;
  createdAt: number;
};

export type ProjectConfig = {
  id: string;
  workspaceId: string;
  name: string;
  type: ProjectType;
  path: string;             // absolute path (CWD for spawning)
  port: number | null;
  https: boolean;
  externalUrl: string | null;
  tags: string[];
  env: Record<string, string>;
  runCommand: string;       // shell command; overrideable by user
  buildCommand: string | null;
  position: number;
  createdAt: number;
};

// ─── Run profiles ────────────────────────────────────────────────────────────

export type RunProfile = {
  id: string;
  projectId: string;
  name: string;
  runCommand: string;
  port: number | null;
  https: boolean;
  externalUrl: string | null;
  position: number;
  createdAt: number;
};

export type RunProfileCreateInput = {
  projectId: string;
  name: string;
  runCommand: string;
  port?: number | null;
  https?: boolean;
  externalUrl?: string | null;
};

export type RunProfileUpdateInput = Partial<{
  name: string;
  runCommand: string;
  port: number | null;
  https: boolean;
  externalUrl: string | null;
  position: number;
}>;

// ─── CRUD inputs ─────────────────────────────────────────────────────────────

export type WorkspaceCreateInput = { name: string };
export type WorkspaceUpdateInput = { name?: string; position?: number };

export type ProjectCreateInput = {
  workspaceId: string;
  name: string;
  type: ProjectType;
  path: string;
  port?: number | null;
  https?: boolean;
  externalUrl?: string | null;
  tags?: string[];
  env?: Record<string, string>;
  runCommand?: string;        // defaults to type's default if omitted
  buildCommand?: string | null;
};

export type ProjectUpdateInput = Partial<{
  name: string;
  type: ProjectType;
  path: string;
  port: number | null;
  https: boolean;
  externalUrl: string | null;
  tags: string[];
  env: Record<string, string>;
  runCommand: string;
  buildCommand: string | null;
  position: number;
}>;

export type ProjectTypeDefaults = {
  runCommand: string;
  port: number | null;
};

// ─── Runtime state ───────────────────────────────────────────────────────────

export type ServiceStatus =
  | 'idle'
  | 'starting'
  | 'running'
  | 'crashed'
  | 'stopped';

export type StartResult =
  | { ok: true }
  | { ok: false; error: string };

export type StopResult =
  | { ok: true }
  | { ok: false; error: string };

export type KillPortResult =
  | { ok: true; killed: number[] }
  | { ok: false; error: string };

export type StatusSnapshot = {
  projectPath: string;
  port: number | null;
  status: ServiceStatus;
  pid: number | null;
  lastExitCode: number | null;
};

export type LogStream = 'stdout' | 'stderr' | 'launcher';

export type LogEvent = {
  projectPath: string;
  stream: LogStream;
  line: string;
  ts: number;
};

export type ExitEvent = {
  projectPath: string;
  code: number | null;
  status: ServiceStatus;
  ts: number;
};

// ─── Renderer API (contextBridge) ────────────────────────────────────────────

export type LauncherApi = {
  // Workspace CRUD
  listWorkspaces: () => Promise<WorkspaceConfig[]>;
  createWorkspace: (input: WorkspaceCreateInput) => Promise<WorkspaceConfig>;
  updateWorkspace: (id: string, input: WorkspaceUpdateInput) => Promise<WorkspaceConfig>;
  deleteWorkspace: (id: string) => Promise<void>;
  reorderWorkspaces: (ids: string[]) => Promise<void>;

  // Project CRUD
  listProjects: (workspaceId: string) => Promise<ProjectConfig[]>;
  createProject: (input: ProjectCreateInput) => Promise<ProjectConfig>;
  updateProject: (id: string, input: ProjectUpdateInput) => Promise<ProjectConfig>;
  deleteProject: (id: string) => Promise<void>;
  reorderProjects: (workspaceId: string, ids: string[]) => Promise<void>;

  // Profile CRUD
  listProfiles: (projectId: string) => Promise<RunProfile[]>;
  listAllProfiles: () => Promise<RunProfile[]>;
  createProfile: (input: RunProfileCreateInput) => Promise<RunProfile>;
  updateProfile: (id: string, input: RunProfileUpdateInput) => Promise<RunProfile>;
  deleteProfile: (id: string) => Promise<void>;

  // Service control (keyed by project.path)
  startService: (args: { projectPath: string; profileId?: string | null }) => Promise<StartResult>;
  stopService: (args: { projectPath: string }) => Promise<StopResult>;
  killServicePort: (args: { projectPath: string; port: number | null }) => Promise<KillPortResult>;
  statusSnapshot: () => Promise<StatusSnapshot[]>;

  // Utilities
  pickDirectory: (args: { defaultPath?: string; title?: string }) => Promise<string | null>;
  openPath: (absolutePath: string) => Promise<void>;
  openExternal: (url: string) => Promise<void>;
  getLocalIp: () => Promise<string | null>;
  getProjectTypeDefaults: (type: ProjectType) => Promise<ProjectTypeDefaults>;

  // Events
  onLog: (cb: (event: LogEvent) => void) => () => void;
  onExit: (cb: (event: ExitEvent) => void) => () => void;

  // App
  relaunch: () => Promise<void>;
};

declare global {
  interface Window {
    launcher: LauncherApi;
  }
}
