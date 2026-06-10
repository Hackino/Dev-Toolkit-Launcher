import type { IProcessStrategy } from '../IProcessStrategy';

export class DotnetStrategy implements IProcessStrategy {
  readonly defaultRunCommand = 'dotnet run';
  readonly defaultPort: number | null = null;

  resolveCommand(_projectPath: string, runCommand: string): string {
    return runCommand;
  }
}
