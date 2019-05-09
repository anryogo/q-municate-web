'use strict';

require.config({
    googlemaps: {
        params: {
            key: 'AIzaSyAhduIkJbVdtRm0Hz6XpkihGt8h_R8cZds',
            libraries: 'geometry'
        }
    },
    baseUrl: 'scripts',
    shim: {
        gmaps: {
            deps: ['googlemaps'],
            exports: 'GMaps'
        },
        cryptojs: {
            exports: 'CryptoJS'
        },
        progressbar: {
            exports: 'ProgressBar'
        },
        minEmoji: {
            exports: 'minEmoji'
        }
    },
    paths: {
    // libs
        googlemaps: '../vendor/googlemaps-amd/googlemaps',
        async: '../vendor/requirejs-plugins/async',
        gmaps: 'https://cdnjs.cloudflare.com/ajax/libs/gmaps.js/0.4.24/gmaps.min',
        cryptojs: '../vendor/crypto-js/crypto-js',
        jquery: '../vendor/jquery/jquery.min',
        underscore: '../vendor/underscore/underscore-min',
        backbone: '../vendor/backbone/backbone-min',
        fetch: '../vendor/fetch/fetch',
        progressbar: '../vendor/progressbar/progressbar.min',
        loadImage: '../vendor/blueimp-load-image/load-image',
        mCustomScrollbar: '../vendor/malihu-custom-scrollbar-plugin/jquery.mCustomScrollbar',
        timeago: '../vendor/jquery-timeago/jquery.timeago',
        minEmoji: '../vendor/emoji/js/minEmoji',
        initTelInput: '../vendor/intl-tel-input/js/intlTelInput.min',
        intlTelInputUtils: '../vendor/intl-tel-input/js/utils',
        nicescroll: '../vendor/jquery-nicescroll/jquery.nicescroll.min',
        perfectscrollbar: '../vendor/perfect-scrollbar/perfect-scrollbar.min',
        QBNotification: '../vendor/web-notifications/qbNotification',
        QBMediaRecorder: '../vendor/media-recorder-js/qbMediaRecorder',
        // Q-municate application
        config: '../.tmp/config',
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
        // apiCalls
        QBApiCalls: 'qbApiCalls',
        // events
        Events: 'events',
        // helpers
        Helpers: 'helpers',
        // custom listeners
        Listeners: 'listeners',
        // templates
        QMHtml: 'qmhtml',
        // entities
        Entities: 'entities',
        // QM Player
        QMPlayer: 'views/qmplayer',
        // Voice Messages
        VoiceMessage: 'voicemessage'
    }
});

require([
    'jquery',
    'config',
    'Helpers',
    'minEmoji',
    'MainModule',
    'backbone',
    'QBNotification',
    'fetch' // the fetch polifil for IE 10+
], function(
    $,
    QMCONFIG,
    Helpers,
    minEmoji,
    QM,
    Backbone,
    QBNotification
) {
    var APP;

    // Application initialization
    $(function() {
    // set Q-MUNICATE version
        $('.j-appVersion').html('v. 1.15.0');

        // Set the chat protocol BOSH for IE(11+)/Edge(14+) browsers
        if (Helpers.isIE11orEdge()) {
            QMCONFIG.QBconf.chatProtocol.active = 1;
        }

        $.ajaxSetup({ cache: true });

        // initialize facebook sdk
        if (FB) {
            FB.init({
                appId: QMCONFIG.fbAccount.appId,
                version: 'v3.0'
            });
        }

        // emoji smiles run
        $('.smiles-group').each(function() {
            var obj = $(this);
            obj.html(minEmoji(obj.text(), true));
        });

        if (QMCONFIG.notification && QBNotification.isSupported()) {
            QBNotification.requestPermission();
        }

        APP = new QM();
        APP.init();
    });
});
