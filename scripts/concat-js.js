var concat = require('concat');

var outputFile = 'app/.tmp/vendor.js';

concat([
    'app/bower_components/requirejs/require.js'
], outputFile);
