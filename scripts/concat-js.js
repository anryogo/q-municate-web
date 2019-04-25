var concat = require('concat');

var outputFile = 'app/.tmp/build.js';

concat([
    'app/bower_components/requirejs/require.js',
    'app/.tmp/bundle.js'
], outputFile);
