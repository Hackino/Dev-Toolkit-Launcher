/**
 * Feature registry — the composition root. This is the ONLY module that knows
 * the full set of language features. Adding a language = add a feature module
 * and register it here (Open/Closed). Features never import this or each other.
 */
import type { ProjectType, MobilePlatform } from '../../shared/types';
import type { LanguageFeature, MobileFeature } from '../core/ports';
import { isMobileFeature } from '../core/ports';

import { dotnetFeature } from './backend/dotnet';
import { nodeFeature } from './backend/node';
import { springBootFeature } from './backend/springBoot';
import { ktorFeature } from './backend/ktor';
import { androidFeature } from './mobile/android';
import { iosFeature } from './mobile/ios';
import { flutterFeature } from './mobile/flutter';
import { reactNativeFeature } from './mobile/reactNative';
import { composeMultiplatformFeature } from './mobile/composeMultiplatform';

const features: Record<ProjectType, LanguageFeature> = {
  // Backend / Web
  'dotnet': dotnetFeature,
  'spring-boot': springBootFeature,
  'ktor': ktorFeature,
  'nextjs': nodeFeature('nextjs', 'dev', 3000),
  'react': nodeFeature('react', 'dev', 5173),
  'nodejs': nodeFeature('nodejs', 'start'),
  'express': nodeFeature('express', 'start'),
  'nestjs': nodeFeature('nestjs', 'start:dev', 3000),
  // Mobile
  'android': androidFeature,
  'ios': iosFeature,
  'flutter': flutterFeature,
  'react-native': reactNativeFeature,
  'compose-multiplatform': composeMultiplatformFeature,
};

export const FeatureRegistry = {
  get(type: ProjectType): LanguageFeature {
    return features[type];
  },

  getMobile(type: MobilePlatform): MobileFeature {
    const feature = features[type];
    if (!isMobileFeature(feature)) throw new Error(`${type} is not a mobile feature`);
    return feature;
  },

  defaults(type: ProjectType): { runCommand: string; port: number | null } {
    return features[type].defaults;
  },

  all(): LanguageFeature[] {
    return Object.values(features);
  },
};
