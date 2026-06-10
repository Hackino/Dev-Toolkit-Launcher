import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { IProcessStrategy } from '../IProcessStrategy';

const INSTALL_CMD = 'npm install --no-audit --no-fund --prefer-offline';

function needsInstall(projectPath: string): boolean {
  const nodeModules = join(projectPath, 'node_modules');
  const internalLock = join(nodeModules, '.package-lock.json');
  const binDir = join(nodeModules, '.bin');
  return !existsSync(nodeModules) || !existsSync(internalLock) || !existsSync(binDir);
}

export class NodeStrategy implements IProcessStrategy {
  readonly defaultRunCommand: string;
  readonly defaultPort: number | null;

  constructor(runScript: string, port: number | null = null) {
    this.defaultRunCommand = `npm run ${runScript}`;
    this.defaultPort = port;
  }

  resolveCommand(projectPath: string, runCommand: string): string {
    if (!needsInstall(projectPath)) return runCommand;
    return `${INSTALL_CMD} && ${runCommand}`;
  }
}
