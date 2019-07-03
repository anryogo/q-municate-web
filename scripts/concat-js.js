'use strict';

const concat = require('concat'); // eslint-disable-line

const outputFile = 'app/.tmp/vendor.js';

concat([
    'node_modules/quickblox/quickblox.min.js',
], outputFile);
