import type { MobileScriptAction } from '../../../shared/types';

/**
 * Predefined one-shot tooling commands for mobile columns. `dir` runs the command
 * in a subfolder when it exists (e.g. Flutter's ios/ and android/), otherwise the
 * project root — so the same action works for Flutter, native, and KMP layouts.
 */
export type MobileScriptDef = { command: string; dir?: 'ios' | 'android' };

export const MOBILE_SCRIPTS: Record<MobileScriptAction, MobileScriptDef> = {
  // Code generation (build_runner / l10n)
  'gen-rebuild': { command: 'dart run build_runner clean && dart run build_runner build --delete-conflicting-outputs' },
  'gen-build': { command: 'dart run build_runner build --delete-conflicting-outputs' },
  'gen-watch': { command: 'dart run build_runner watch --delete-conflicting-outputs' },
  'gen-clean': { command: 'dart run build_runner clean' },
  'gen-l10n': { command: 'flutter gen-l10n' },
  // Assets
  'icons': { command: 'dart run flutter_launcher_icons' },
  'splash': { command: 'dart run flutter_native_splash:create' },
  // Tooling
  'format': { command: 'dart format .' },
  'analyze': { command: 'flutter analyze' },
  'test': { command: 'flutter test' },
  'pub-get': { command: 'flutter pub get' },
  'pub-upgrade': { command: 'flutter pub upgrade' },
  'pub-outdated': { command: 'flutter pub outdated' },
  'doctor': { command: 'flutter doctor -v' },
  // iOS / CocoaPods
  'pod-install': { command: 'pod install', dir: 'ios' },
  'pod-update': { command: 'pod update', dir: 'ios' },
  'pod-repo-update': { command: 'pod repo update', dir: 'ios' },
  'open-xcode': { command: 'open Runner.xcworkspace 2>/dev/null || open ./*.xcworkspace 2>/dev/null || open ./*.xcodeproj', dir: 'ios' },
  'clean-derived': { command: 'rm -rf ~/Library/Developer/Xcode/DerivedData' },
  // Android / Gradle
  'gradle-clean': { command: './gradlew clean', dir: 'android' },
  'gradle-deps': { command: './gradlew :app:dependencies', dir: 'android' },
  'gradle-stop': { command: './gradlew --stop', dir: 'android' },
};
