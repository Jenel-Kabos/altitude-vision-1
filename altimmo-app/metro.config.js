const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.resolver.sourceExts = [
  ...config.resolver.sourceExts,
  'cjs',
];

config.resolver.extraNodeModules = {
  'react-native-safe-area-context': require.resolve('./src/utils/safeMock.js'),
};

module.exports = config;
