// electron-builder afterPack hook: apply a proper ad-hoc signature to the whole
// macOS bundle (helpers, frameworks, app). Without this, an unsigned/partially
// signed app fails Gatekeeper as "is damaged and can't be opened" once a
// downloaded copy is quarantined. Ad-hoc signing avoids the "damaged" error
// (users still right-click → Open the first time, since it isn't notarized).
const { execSync } = require('node:child_process');

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'darwin') return;
  const appName = context.packager.appInfo.productFilename;
  const appPath = `${context.appOutDir}/${appName}.app`;
  // --force overwrites the linker's partial sig; --deep signs nested code; "-" = ad-hoc.
  execSync(`codesign --force --deep --sign - "${appPath}"`, { stdio: 'inherit' });
  console.log(`  • ad-hoc signed ${appPath}`);
};
