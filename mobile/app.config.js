const appJson = require('./app.json');
const withAndroidCleartext = require('./plugins/withAndroidCleartext');

/** HTTPS via sslip.io — plain HTTP to a raw IP is blocked on many Android builds. */
const DEFAULT_API_URL = 'https://84-8-220-241.sslip.io';

/** @type {import('expo/config').ExpoConfig} */
module.exports = () => ({
  ...appJson.expo,
  android: {
    ...appJson.expo.android,
    usesCleartextTraffic: true,
  },
  plugins: [...(appJson.expo.plugins ?? []), withAndroidCleartext],
  extra: {
    ...appJson.expo.extra,
    apiUrl: process.env.EXPO_PUBLIC_API_URL || DEFAULT_API_URL,
  },
});
