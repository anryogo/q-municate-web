var fs = require('fs');
var path = require('path');
var settings = require('./env/' + process.env.NODE_ENV);

var filePath = path.resolve('app/configs/', 'main_config.js');
var content = 'define(' + JSON.stringify(settings) + ');';

fs.writeFile(filePath, content, function(err) {
    if (err) {
        throw err;
    }
});
