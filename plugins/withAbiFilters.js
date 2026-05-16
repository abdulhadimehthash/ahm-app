// plugins/withAbiFilters.js
// Forces armeabi-v7a (32-bit) support so Samsung J5 Prime can install the APK

const { withAppBuildGradle } = require('@expo/config-plugins');

module.exports = function withAbiFilters(config) {
  return withAppBuildGradle(config, (config) => {
    const contents = config.modResults.contents;

    // If already patched, skip
    if (contents.includes('abiFilters')) {
      console.log('[withAbiFilters] Already patched, skipping.');
      return config;
    }

    // Match the defaultConfig { block directly — most reliable insertion point
    const patched = contents.replace(
      /defaultConfig\s*\{/,
      `defaultConfig {\n        ndk {\n            abiFilters "armeabi-v7a", "arm64-v8a"\n        }`
    );

    if (patched === contents) {
      console.warn('[withAbiFilters] WARNING: Could not find defaultConfig block — ABI filter NOT applied!');
    } else {
      console.log('[withAbiFilters] ✅ ABI filters applied: armeabi-v7a, arm64-v8a');
    }

    config.modResults.contents = patched;
    return config;
  });
};
