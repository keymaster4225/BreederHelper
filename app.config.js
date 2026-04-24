const appJson = require('./app.json');

module.exports = () => ({
  ...appJson.expo,
  plugins: [
    ...(appJson.expo.plugins ?? []),
    'expo-localization',
  ],
  extra: {
    ...appJson.expo.extra,
    buildProfile: process.env.EAS_BUILD_PROFILE ?? null,
  },
});
