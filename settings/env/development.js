var baseSettings = require('./base');

var settings = Object.assign({}, baseSettings, {
    qbAccount: {
        appId: 76743,
        authKey: 'exCV7U-V4BY-t4X',
        authSecret: '6zYUFGZFQFWmL3v'
    },

    fbAccount: {
        appId: '870667166610487',
        scope: 'email,user_friends'
    },

    firebase: {
        apiKey: 'AIzaSyBJyZil_RbU1UB6meICn-32JsN1RNeo0Ec',
        authDomain: 'q-municate-web.firebaseapp.com',
        databaseURL: 'https://q-municate-web.firebaseio.com',
        projectId: 'q-municate-web',
        storageBucket: 'q-municate-web.appspot.com',
        messagingSenderId: '661916700459'
    }
});

module.exports = settings;
