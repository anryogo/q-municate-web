'use strict';

const path = require('path');
const autoprefixer = require('autoprefixer');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

const isDevMode = process.env.NODE_ENV === 'development';

const basePath = path.resolve(__dirname, 'app');
const settingsPath = path.resolve(__dirname, 'settings');

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
                    test: /(node_modules|vendor)/,
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
            {
                test: /\.css$/,
                use: [
                    MiniCssExtractPlugin.loader,
                    'css-loader',
                ],
            },
            {
                test: /\.scss$/,
                exclude: /(node_modules|vendor)/,
                use: [
                    MiniCssExtractPlugin.loader,
                    { loader: 'css-loader', options: { sourceMap: true } },
                    {
                        loader: 'postcss-loader',
                        options: {
                            ident: 'postcss',
                            plugins: [autoprefixer],
                            sourceMap: true,
                        },
                    },
                    { loader: 'sass-loader', options: { sourceMap: true } },
                ],
            },
            {
                test: /\.(png|jpe?g|gif|svg)$/,
                loader: 'url-loader',
                options: {
                    name: '[name].[ext]',
                    outputPath: 'images',
                    limit: 8192,
                },
            },
        ],
    },

    plugins: [
        new MiniCssExtractPlugin(),
    ],
};
