import $ from 'jquery';
import QMCONFIG from 'config';
import User from 'models/user';
import Session from 'models/session';
import Settings from 'models/settings';
import Contact from 'models/contact';
import Dialog from 'models/dialog';
import Message from 'models/message';
import Attach from 'models/attach';
import ContactList from 'models/contact_list';
import VideoChat from 'models/videochat';
import Cursor from 'models/custom_cursor';
import SyncTabs from 'models/sync_tabs';
import FirebaseWidget from 'models/firebase_widget';
import UserView from 'views/user';
import SettingsView from 'views/settings';
import DialogView from 'views/dialog';
import MessageView from 'views/message';
import AttachView from 'views/attach';
import ContactListView from 'views/contact_list';
import VideoChatView from 'views/videochat';
import QMPlayer from 'views/qmplayer';
import Events from './events';
import Helpers from './helpers';
import QBApiCalls from './qbApiCalls';
import Entities from './entities';
import Listeners from './listeners';
import VoiceMessage from './voicemessage';

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
    if (
      localStorage['QM.session'] &&
      localStorage['QM.user'] &&
      // new QB release account (13.02.2015)
      localStorage[IS_RELEASE_QB_ACCOUNT]
    ) {
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

export default QM;
