/**
 * Expo config plugin: react-native-iap için Podfile post_install (Folly defines).
 * RNIap podspec'te RCT-Folly bağımlılığı patch ile kaldırıldı; sadece post_install kaldı.
 */
const { withDangerousMod } = require('expo/config-plugins');
const path = require('path');
const fs = require('fs').promises;

function withIosRctFollyPod(config) {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const podfilePath = path.join(config.modRequest.platformProjectRoot, 'Podfile');
      let contents = await fs.readFile(podfilePath, 'utf-8');

      // post_install: Folly coroutines kapat (NitroIap/RNIap)
      const postInstallMarker = '# Folly coroutines fix (react-native-iap)';
      if (!contents.includes(postInstallMarker)) {
        const follyFixLines = [
          '# Folly coroutines fix (react-native-iap + RCT-Folly RelaxedAtomic)',
          "installer.pods_project.targets.each do |target|",
          "  next unless ['NitroIap', 'RNIap'].include?(target.name)",
          "  target.build_configurations.each do |config|",
          "    config.build_settings['GCC_PREPROCESSOR_DEFINITIONS'] ||= ['$(inherited)']",
          "    config.build_settings['GCC_PREPROCESSOR_DEFINITIONS'] << 'FOLLY_NO_CONFIG=1'",
          "    config.build_settings['GCC_PREPROCESSOR_DEFINITIONS'] << 'FOLLY_CFG_NO_COROUTINES=1'",
          "    config.build_settings['GCC_PREPROCESSOR_DEFINITIONS'] << 'FOLLY_HAS_COROUTINES=0'",
          "  end",
          "end",
        ];
        const indent = '    ';
        const follyFix = follyFixLines.map((l) => indent + l).join('\n');
        contents = contents.replace(
          /(post_install do \|installer\|)\n(\s+)/m,
          `$1\n${follyFix}\n$2`
        );
      }

      await fs.writeFile(podfilePath, contents);
      return config;
    },
  ]);
}

module.exports = withIosRctFollyPod;
