export interface IProcessStrategy {
  /** Shell command to run the project (CWD = project.path). */
  readonly defaultRunCommand: string;

  /** Default HTTP port for this project type (null if not applicable). */
  readonly defaultPort: number | null;

  /**
   * Resolve the final shell command for a specific project path and user-supplied
   * run command. Strategies may prepend install steps, adjust paths, etc.
   */
  resolveCommand(projectPath: string, runCommand: string): string;
}
