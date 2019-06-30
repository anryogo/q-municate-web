'use strict';

const concat = require('concat'); // eslint-disable-line

const outputFile = 'app/.tmp/vendor.js';

concat([
    'app/vendor/quickblox/quickblox.js',
    'app/vendor/firebase/firebase.min.js',
    'app/vendor/requirejs/require.js',
], outputFile);
