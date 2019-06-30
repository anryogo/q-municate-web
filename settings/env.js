'use strict';

const path = require('path');
const fse = require('fs-extra'); // eslint-disable-line
const settings = require(`./env/${process.env.NODE_ENV}`); // eslint-disable-line

const filePath = path.resolve('app/.tmp/', 'config.js');
const content = `define(${JSON.stringify(settings)});`;

fse.outputFile(filePath, content, (err) => {
    if (err) {
        throw err;
    }
});
