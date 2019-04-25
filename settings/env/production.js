var baseSettings = require('./base');

var settings = Object.assign({}, baseSettings, {
    qbAccount: {
        appId: 13318,
        authKey: 'WzrAY7vrGmbgFfP',
        authSecret: 'xS2uerEveGHmEun'
    },

    fbAccount: {
        appId: '605405446247805',
        scope: 'email,user_friends'
    },

    firebase: {
        apiKey: 'AIzaSyBngIcgrzjJVOLXaDzFf7HVfieh7TZTLr8',
        authDomain: 'teak-perigee-572.firebaseapp.com',
        databaseURL: 'https://teak-perigee-572.firebaseio.com',
        projectId: 'teak-perigee-572',
        storageBucket: 'teak-perigee-572.appspot.com',
        messagingSenderId: '265299067289'
    }
});

module.exports = settings;
