import { existsSync, chmodSync } from 'node:fs';
import { join } from 'node:path';
import type { LanguageFeature } from '../../core/ports';

export const ktorFeature: LanguageFeature = {
  type: 'ktor',
  category: 'backend',
  defaults: { runCommand: './gradlew run', port: 8080 },
  resolveRunCommand(projectPath, runCommand) {
    if (process.platform !== 'win32') {
      for (const wrapper of ['gradlew', 'mvnw']) {
        const p = join(projectPath, wrapper);
        if (existsSync(p)) {
          try { chmodSync(p, 0o755); } catch { /* ignore */ }
        }
      }
    }
    return runCommand;
  },
};
