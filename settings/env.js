var path = require('path');
var fse = require('fs-extra');
var settings = require('./env/' + process.env.NODE_ENV);

var filePath = path.resolve('app/.tmp/', 'config.js');
var content = 'define(' + JSON.stringify(settings) + ');';

fse.outputFile(filePath, content, function(err) {
    if (err) {
        throw err;
    }
});
