import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { ProjectType } from '../../../shared/types';
import type { LanguageFeature } from '../../core/ports';

const INSTALL_CMD = 'npm install --no-audit --no-fund --prefer-offline';

function needsInstall(projectPath: string): boolean {
  const nodeModules = join(projectPath, 'node_modules');
  const internalLock = join(nodeModules, '.package-lock.json');
  const binDir = join(nodeModules, '.bin');
  return !existsSync(nodeModules) || !existsSync(internalLock) || !existsSync(binDir);
}

/**
 * Node-family feature factory. The runtimes (Next.js, React, Node, Express,
 * Nest.js) differ only in their default run script + port, so they share one
 * implementation parameterized here — each is still registered as its own
 * feature in the registry.
 */
export function nodeFeature(
  type: ProjectType,
  runScript: string,
  port: number | null = null,
): LanguageFeature {
  return {
    type,
    category: 'backend',
    defaults: { runCommand: `npm run ${runScript}`, port },
    resolveRunCommand: (projectPath, runCommand) =>
      needsInstall(projectPath) ? `${INSTALL_CMD} && ${runCommand}` : runCommand,
  };
}
