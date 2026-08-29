const appJson = require('./app.json');

/** Production Oracle VM — used when env vars are missing from EAS cloud builds. */
const DEFAULT_API_URL = 'http://84.8.220.241:3000';

/** @type {import('expo/config').ExpoConfig} */
module.exports = () => ({
  ...appJson.expo,
  android: {
    ...appJson.expo.android,
    usesCleartextTraffic: true,
  },
  extra: {
    ...appJson.expo.extra,
    apiUrl: process.env.EXPO_PUBLIC_API_URL || DEFAULT_API_URL,
  },
});
