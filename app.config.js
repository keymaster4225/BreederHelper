const appJson = require('./app.json');

module.exports = () => ({
  ...appJson.expo,
  extra: {
    ...appJson.expo.extra,
    buildProfile: process.env.EAS_BUILD_PROFILE ?? null,
  },
});
