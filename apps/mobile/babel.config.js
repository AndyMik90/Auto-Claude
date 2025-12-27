module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Required for react-native-paper tree-shaking and optimal bundle size
      'react-native-paper/babel',
      // Required for react-native-reanimated - MUST be listed last
      'react-native-reanimated/plugin',
    ],
  };
};
