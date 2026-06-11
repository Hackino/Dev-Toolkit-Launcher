import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { ProjectType } from '../../../shared/types';
import type { LanguageFeature } from '../../core/ports';

// NOTE: no `--prefer-offline`. That flag makes npm resolve against cached
// package metadata and skip revalidation, so a transitive dependency version
// published after the local cache was last refreshed fails with ETARGET even
// though it exists on the registry. npm still reuses cached tarballs without it.
const INSTALL_CMD = 'npm install --no-audit --no-fund';

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
