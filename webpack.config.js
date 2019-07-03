'use strict';

const path = require('path');
const webpack = require('webpack');

const basePath = path.resolve(__dirname, 'app');
const settingsPath = path.resolve(__dirname, 'settings');

module.exports = {
    mode: process.env.NODE_ENV,
    devtool: process.env.NODE_ENV === 'development' ? 'cheap-module-source-map' : false,

    entry: './app/scripts/main.js',
    output: {
        path: `${basePath}/.tmp`,
        filename: 'build.js',
    },

    resolve: {
        modules: [
            `${basePath}/vendor`,
            path.resolve(__dirname, 'node_modules'),
        ],
        alias: {
            // libs
            minEmoji: 'emoji/js/minEmoji',
            initTelInput: 'intl-tel-input/js/intlTelInput.min',
            intlTelInputUtils: 'intl-tel-input/js/utils',
            progressbar: 'progressbar/progressbar.min',

            // Q-municate application
            config: `${settingsPath}/env`,
            models: `${basePath}/scripts/models`,
            views: `${basePath}/scripts/views`,
        },
    },

    module: {
        rules: [
            {
                test: /minEmoji/,
                use: 'exports-loader?minEmoji',
            },
            {
                test: /progressbar/,
                use: 'exports-loader?ProgressBar',
            },
            {
                test: /\.js$/,
                exclude: [
                    path.resolve(__dirname, 'node_modules'),
                    `${basePath}/vendor`,
                    `${basePath}/workers`,
                ],
                loader: 'babel-loader',
            },
        ],
    },

    plugins: [
        new webpack.optimize.LimitChunkCountPlugin({
            maxChunks: 1,
        }),
    ],
};
