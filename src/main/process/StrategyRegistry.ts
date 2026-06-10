import type { ProjectType } from '../../shared/types';
import type { IProcessStrategy } from './IProcessStrategy';
import { DotnetStrategy } from './strategies/DotnetStrategy';
import { NodeStrategy } from './strategies/NodeStrategy';
import { SpringBootStrategy } from './strategies/SpringBootStrategy';
import { KtorStrategy } from './strategies/KtorStrategy';

const registry: Record<ProjectType, IProcessStrategy> = {
  'dotnet':      new DotnetStrategy(),
  'spring-boot': new SpringBootStrategy(),
  'ktor':        new KtorStrategy(),
  'nextjs':      new NodeStrategy('dev', 3000),
  'react':       new NodeStrategy('dev', 5173),
  'nodejs':      new NodeStrategy('start'),
  'express':     new NodeStrategy('start'),
  'nestjs':      new NodeStrategy('start:dev', 3000),
};

export const StrategyRegistry = {
  get(type: ProjectType): IProcessStrategy {
    return registry[type];
  },

  defaults(type: ProjectType): { runCommand: string; port: number | null } {
    const s = registry[type];
    return { runCommand: s.defaultRunCommand, port: s.defaultPort };
  },
};
