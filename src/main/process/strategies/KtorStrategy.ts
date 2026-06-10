import { existsSync, chmodSync } from 'node:fs';
import { join } from 'node:path';
import type { IProcessStrategy } from '../IProcessStrategy';

export class KtorStrategy implements IProcessStrategy {
  readonly defaultRunCommand = './gradlew run';
  readonly defaultPort: number | null = 8080;

  resolveCommand(projectPath: string, runCommand: string): string {
    if (process.platform !== 'win32') {
      const gradlew = join(projectPath, 'gradlew');
      if (existsSync(gradlew)) {
        try { chmodSync(gradlew, 0o755); } catch { /* ignore */ }
      }
    }
    return runCommand;
  }
}
