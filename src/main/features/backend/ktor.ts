import { existsSync, chmodSync } from 'node:fs';
import { join } from 'node:path';
import type { LanguageFeature } from '../../core/ports';

export const ktorFeature: LanguageFeature = {
  type: 'ktor',
  category: 'backend',
  defaults: { runCommand: './gradlew run', port: 8080 },
  resolveRunCommand(projectPath, runCommand) {
    if (process.platform !== 'win32') {
      const gradlew = join(projectPath, 'gradlew');
      if (existsSync(gradlew)) {
        try { chmodSync(gradlew, 0o755); } catch { /* ignore */ }
      }
    }
    return runCommand;
  },
};
