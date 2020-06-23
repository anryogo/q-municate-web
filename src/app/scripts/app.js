const $ = require('jquery');

const QMCONFIG = require('config');

const User = require('models/user');
const Session = require('models/session');
const Settings = require('models/settings');
const Contact = require('models/contact');
const Dialog = require('models/dialog');
const Message = require('models/message');
const Attach = require('models/attach');
const ContactList = require('models/contact_list');
const VideoChat = require('models/videochat');
const Cursor = require('models/custom_cursor');
const SyncTabs = require('models/sync_tabs');
const FirebaseWidget = require('models/firebase_widget');

const UserView = require('views/user');
const SettingsView = require('views/settings');
const DialogView = require('views/dialog');
const MessageView = require('views/message');
const AttachView = require('views/attach');
const ContactListView = require('views/contact_list');
const VideoChatView = require('views/videochat');
const QMPlayer = require('views/qmplayer');

const Events = require('./events');
const Helpers = require('./helpers');
const QBApiCalls = require('./qbApiCalls');
const Entities = require('./entities');
const Listeners = require('./listeners');
const VoiceMessage = require('./voicemessage');

/*
 * Q-municate chat application
 *
 * Main Module
 *
 */
const IS_RELEASE_QB_ACCOUNT = 'QM.isReleaseQBAccount';

function QM() {
    this.listeners = new Listeners(this);

    this.models = {
        User: new User(this),
        Session: new Session(this),
        Settings: new Settings(this),
        Contact: new Contact(this),
        Dialog: new Dialog(this),
        Message: new Message(this),
        Attach: new Attach(this),
        ContactList: new ContactList(this),
        VideoChat: new VideoChat(this),
        Cursor: new Cursor(this),
        SyncTabs: new SyncTabs(this),
        VoiceMessage: new VoiceMessage(this),
    };

    this.views = {
        User: new UserView(this),
        Settings: new SettingsView(this),
        Dialog: new DialogView(this),
        Message: new MessageView(this),
        Attach: new AttachView(this),
        ContactList: new ContactListView(this),
        VideoChat: new VideoChatView(this),
    };

    this.events = new Events(this);
    this.service = new QBApiCalls(this);

    this.entities = Entities;
    this.entities.app = this;

    this.QMPlayer = QMPlayer;
    this.FirebaseWidget = FirebaseWidget;
}

QM.prototype = {
    init() {
        let session;
        let token;

        this.setHtml5Patterns();
        this.preloader();

        // QB SDK initialization
        // Checking if autologin was chosen
        if (localStorage['QM.session'] && localStorage['QM.user']
            // new QB release account (13.02.2015)
            && localStorage[IS_RELEASE_QB_ACCOUNT]) {
            session = JSON.parse(localStorage['QM.session']);
            token = session && session.token;
            this.service.init(token);
        } else if (localStorage[IS_RELEASE_QB_ACCOUNT]) {
            this.service.init();
        } else {
            // removing the old cached data from LocalStorage
            localStorage.clear();
            localStorage.setItem(IS_RELEASE_QB_ACCOUNT, '1');
            this.service.init();
        }

        this.events.init();
        this.listeners.init();

        Helpers.log('App init', this);
    },

    preloader() {
        const spinner = $('#welcomePage .l-spinner');

        spinner.addClass('is-hidden');
        spinner.prevAll().removeClass('is-hidden');
    },

    setHtml5Patterns() {
        $('.pattern-name').attr('pattern', QMCONFIG.patterns.name);
        $('.pattern-pass').attr('pattern', QMCONFIG.patterns.password);
    },
};

module.exports = QM;
