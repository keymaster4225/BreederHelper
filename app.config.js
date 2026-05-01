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
    runPhotosArchiveSpike: process.env.EXPO_PUBLIC_RUN_PHOTOS_ARCHIVE_SPIKE === '1',
  },
});
