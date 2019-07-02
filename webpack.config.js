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
            `${basePath}/scripts`,
            `${basePath}/vendor`,
        ],
        alias: {
            // libs
            cryptojs: 'crypto-js/crypto-js',
            jquery: 'jquery/jquery.min',
            underscore: 'underscore/underscore-min',
            backbone: 'backbone/backbone-min',
            fetch: 'fetch/fetch',
            progressbar: 'progressbar/progressbar.min',
            loadImage: 'blueimp-load-image/load-image',
            mCustomScrollbar: 'malihu-custom-scrollbar-plugin/jquery.mCustomScrollbar',
            mousewheel: 'jquery-mousewheel/jquery.mousewheel.min',
            'jquery-mousewheel': 'jquery-mousewheel/jquery.mousewheel.min',
            timeago: 'jquery-timeago/jquery.timeago',
            minEmoji: 'emoji/js/minEmoji',
            initTelInput: 'intl-tel-input/js/intlTelInput.min',
            intlTelInputUtils: 'intl-tel-input/js/utils',
            nicescroll: 'jquery-nicescroll/jquery.nicescroll.min',
            perfectscrollbar: 'perfect-scrollbar/perfect-scrollbar.min',
            QBNotification: 'web-notifications/qbNotification',
            QBMediaRecorder: 'media-recorder-js/qbMediaRecorder',

            // Q-municate application
            config: `${settingsPath}/env`,
            MainModule: 'app',

            // models
            UserModule: 'models/user',
            SessionModule: 'models/session',
            SettingsModule: 'models/settings',
            ContactModule: 'models/contact',
            DialogModule: 'models/dialog',
            MessageModule: 'models/message',
            AttachModule: 'models/attach',
            ContactListModule: 'models/contact_list',
            VideoChatModule: 'models/videochat',
            CursorModule: 'models/custom_cursor',
            SyncTabsModule: 'models/sync_tabs',
            FirebaseWidget: 'models/firebase_widget',

            // views
            UserView: 'views/user',
            SettingsView: 'views/settings',
            DialogView: 'views/dialog',
            MessageView: 'views/message',
            AttachView: 'views/attach',
            ContactListView: 'views/contact_list',
            VideoChatView: 'views/videochat',
            LocationView: 'views/location',
            QMPlayer: 'views/qmplayer',

            // others
            QBApiCalls: 'qbApiCalls',
            Events: 'appEvents',
            Helpers: 'helpers',
            Listeners: 'listeners',
            QMHtml: 'qmhtml',
            Entities: 'entities',
            VoiceMessage: 'voicemessage',
        },
    },

    module: {
        rules: [
            {
                test: /cryptojs/,
                use: 'exports-loader?CryptoJS',
            },
            {
                test: /progressbar/,
                use: 'exports-loader?ProgressBar',
            },
            {
                test: /minEmoji/,
                use: 'exports-loader?minEmoji',
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
