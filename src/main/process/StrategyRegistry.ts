import type { ProjectType, MobilePlatform } from '../../shared/types';
import type { IProcessStrategy, IMobileStrategy } from './IProcessStrategy';
import { DotnetStrategy } from './strategies/DotnetStrategy';
import { NodeStrategy } from './strategies/NodeStrategy';
import { SpringBootStrategy } from './strategies/SpringBootStrategy';
import { KtorStrategy } from './strategies/KtorStrategy';
import { AndroidStrategy } from './strategies/AndroidStrategy';
import { IosStrategy } from './strategies/IosStrategy';
import { FlutterStrategy } from './strategies/FlutterStrategy';
import { ReactNativeStrategy } from './strategies/ReactNativeStrategy';
import { ComposeMultiplatformStrategy } from './strategies/ComposeMultiplatformStrategy';

const registry: Record<ProjectType, IProcessStrategy> = {
  // Backend / Web
  'dotnet':               new DotnetStrategy(),
  'spring-boot':          new SpringBootStrategy(),
  'ktor':                 new KtorStrategy(),
  'nextjs':               new NodeStrategy('dev', 3000),
  'react':                new NodeStrategy('dev', 5173),
  'nodejs':               new NodeStrategy('start'),
  'express':              new NodeStrategy('start'),
  'nestjs':               new NodeStrategy('start:dev', 3000),
  // Mobile
  'android':              new AndroidStrategy(),
  'ios':                  new IosStrategy(),
  'flutter':              new FlutterStrategy(),
  'react-native':         new ReactNativeStrategy(),
  'compose-multiplatform':new ComposeMultiplatformStrategy(),
};

export const StrategyRegistry = {
  get(type: ProjectType): IProcessStrategy {
    return registry[type];
  },

  getMobile(type: MobilePlatform): IMobileStrategy {
    const s = registry[type];
    if (!('buildCommand' in s)) throw new Error(`${type} is not a mobile strategy`);
    return s as IMobileStrategy;
  },

  defaults(type: ProjectType): { runCommand: string; port: number | null } {
    const s = registry[type];
    return { runCommand: s.defaultRunCommand, port: s.defaultPort };
  },
};
