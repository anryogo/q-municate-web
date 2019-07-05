'use strict';

const path = require('path');

const basePath = path.resolve(__dirname, 'app');
const settingsPath = path.resolve(__dirname, 'settings');

const isDevMode = process.env.NODE_ENV === 'development';

module.exports = {
    mode: process.env.NODE_ENV,
    devtool: isDevMode ? 'cheap-module-source-map' : false,

    entry: {
        build: './app/scripts/main.js',
    },
    output: {
        filename: '[name].js',
        path: `${basePath}/.tmp`,
    },

    optimization: {
        splitChunks: {
            cacheGroups: {
                vendor: {
                    test: /node_modules/,
                    chunks: 'initial',
                    name: 'vendor',
                },
            },
        },
    },

    resolve: {
        modules: [
            `${basePath}/vendor`,
            'node_modules',
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
                exclude: /(node_modules|vendor|workers)/,
                use: {
                    loader: 'babel-loader',
                    options: {
                        cacheDirectory: true,
                    },
                },
            },
        ],
    },
};
