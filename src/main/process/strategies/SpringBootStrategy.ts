import { existsSync, chmodSync } from 'node:fs';
import { join } from 'node:path';
import type { IProcessStrategy } from '../IProcessStrategy';

function defaultCommand(projectPath: string): string {
  const isWindows = process.platform === 'win32';
  if (existsSync(join(projectPath, 'gradlew'))) {
    return isWindows ? 'gradlew.bat bootRun' : './gradlew bootRun';
  }
  if (existsSync(join(projectPath, 'mvnw'))) {
    return isWindows ? 'mvnw.cmd spring-boot:run' : './mvnw spring-boot:run';
  }
  return 'mvn spring-boot:run';
}

export class SpringBootStrategy implements IProcessStrategy {
  readonly defaultRunCommand = './gradlew bootRun';
  readonly defaultPort: number | null = 8080;

  resolveCommand(projectPath: string, runCommand: string): string {
    // If user left the default, try to detect the actual wrapper.
    if (runCommand === this.defaultRunCommand) {
      return defaultCommand(projectPath);
    }
    // Ensure gradlew/mvnw is executable on Unix.
    if (process.platform !== 'win32') {
      for (const w of ['gradlew', 'mvnw']) {
        const p = join(projectPath, w);
        if (existsSync(p)) {
          try { chmodSync(p, 0o755); } catch { /* ignore */ }
        }
      }
    }
    return runCommand;
  }
}
