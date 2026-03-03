/**
 * Expo config plugin: Podfile'a RCT-Folly podspec yolunu ekler.
 * EAS Build'ta react-native-iap (RNIap) "Unable to find a specification for RCT-Folly" hatasını giderir.
 * RNIap podspec'i New Arch açıkken RCT-Folly istiyor; bu satır CocoaPods'un spec'i bulmasını sağlar.
 */
const { withDangerousMod } = require('expo/config-plugins');
const path = require('path');
const fs = require('fs').promises;

const RCT_FOLLY_MARKER = '# RCT-Folly pod (react-native-iap EAS fix)';
const POD_LINE = `  pod 'RCT-Folly', :podspec => File.join(Pod::Config.instance.installation_root, '../node_modules/react-native/third-party-podspecs/RCT-Folly.podspec')`;

function withIosRctFollyPod(config) {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const podfilePath = path.join(config.modRequest.platformProjectRoot, 'Podfile');
      let contents = await fs.readFile(podfilePath, 'utf-8');

      if (contents.includes(RCT_FOLLY_MARKER) || contents.includes("pod 'RCT-Folly'")) {
        return config;
      }

      // use_expo_modules! satırından hemen önce ekle (target içinde, tüm pod'lar için geçerli)
      const anchor = /^(\s*use_expo_modules!)/m;
      if (anchor.test(contents)) {
        contents = contents.replace(
          anchor,
          `${RCT_FOLLY_MARKER}\n${POD_LINE}\n$1`
        );
      }

      await fs.writeFile(podfilePath, contents);
      return config;
    },
  ]);
}

module.exports = withIosRctFollyPod;
