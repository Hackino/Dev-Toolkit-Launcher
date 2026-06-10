import { existsSync, chmodSync } from 'node:fs';
import { join } from 'node:path';
import type { LanguageFeature } from '../../core/ports';

const DEFAULT_RUN = './gradlew bootRun';

function detectWrapperCommand(projectPath: string): string {
  const isWindows = process.platform === 'win32';
  if (existsSync(join(projectPath, 'gradlew'))) {
    return isWindows ? 'gradlew.bat bootRun' : './gradlew bootRun';
  }
  if (existsSync(join(projectPath, 'mvnw'))) {
    return isWindows ? 'mvnw.cmd spring-boot:run' : './mvnw spring-boot:run';
  }
  return 'mvn spring-boot:run';
}

export const springBootFeature: LanguageFeature = {
  type: 'spring-boot',
  category: 'backend',
  defaults: { runCommand: DEFAULT_RUN, port: 8080 },
  resolveRunCommand(projectPath, runCommand) {
    if (runCommand === DEFAULT_RUN) return detectWrapperCommand(projectPath);
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
