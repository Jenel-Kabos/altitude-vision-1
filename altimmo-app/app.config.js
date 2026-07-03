const appJson = require('./app.json');
const expo = appJson.expo;

module.exports = {
  expo: {
    ...expo,
    android: {
      ...expo.android,
      config: {
        googleMaps: {
          apiKey: process.env.GOOGLE_MAPS_API_KEY,
        },
      },
    },
  },
};
