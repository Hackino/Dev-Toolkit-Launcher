import type { LanguageFeature } from '../../core/ports';

export const dotnetFeature: LanguageFeature = {
  type: 'dotnet',
  category: 'backend',
  defaults: { runCommand: 'dotnet run', port: null },
  resolveRunCommand: (_projectPath, runCommand) => runCommand,
};
