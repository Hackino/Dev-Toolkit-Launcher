/**
 * Application service for projects. Sits between IPC and the repository: it
 * resolves feature-specific defaults (run command, port) so the repository
 * stays pure persistence with no knowledge of features.
 */
import type { ProjectConfig, ProjectCreateInput } from '../../shared/types';
import { categoryOfType } from '../../shared/category';
import { ProjectRepository } from '../capabilities/persistence/ProjectRepository';
import { FeatureRegistry } from '../features/registry';

export const ProjectService = {
  create(input: ProjectCreateInput): ProjectConfig {
    const category = input.category ?? categoryOfType(input.type);

    let runCommand = input.runCommand;
    let port = input.port;

    if (category === 'mobile') {
      // Mobile projects build via the mobile:* IPC, not a long-lived run command.
      runCommand = runCommand ?? '';
      port = port !== undefined ? port : null;
    } else {
      const defaults = FeatureRegistry.defaults(input.type);
      runCommand = runCommand ?? defaults.runCommand;
      port = port !== undefined ? port : defaults.port;
    }

    return ProjectRepository.create({ ...input, category, runCommand, port });
  },
};
