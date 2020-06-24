import $ from 'jquery';
import QB from 'quickblox';
import QMCONFIG from 'config';
import Location from 'views/location';
import Entities from './entities';
import Helpers from './helpers';

/*
 * Q-municate chat application
 *
 * QuickBlox JS SDK Wrapper
 *
 */
let Session;
let UserView;
let DialogView;
let ContactListView;
let ContactList;
let Listeners;

let timer;
let fail;
let failForgot;
let failSearch;

let self;

function QBApiCalls(app) {
  this.app = app;
  self = this;

  /* eslint-disable prefer-destructuring */
  Session = this.app.models.Session;
  UserView = this.app.views.User;
  DialogView = this.app.views.Dialog;
  ContactListView = this.app.views.ContactList;
  ContactList = this.app.models.ContactList;
  Listeners = this.app.listeners;
  /* eslint-enable prefer-destructuring */
}

QBApiCalls.prototype = {

  init(token) {
    if (typeof token === 'undefined') {
      // eslint-disable-next-line max-len
      QB.init(QMCONFIG.qbAccount.appId, QMCONFIG.qbAccount.authKey, QMCONFIG.qbAccount.authSecret, QMCONFIG.QBconf);
    } else {
      QB.init(token, QMCONFIG.qbAccount.appId, null, QMCONFIG.QBconf);
      QB.service.qbInst.session.application_id = QMCONFIG.qbAccount.appId;
      QB.service.qbInst.config.creds = QMCONFIG.qbAccount;

      Session.create(JSON.parse(localStorage['QM.session']));
      UserView.autologin();
    }

    Helpers.log('QB init', this);

    // init dialog's collection with starting app
    Entities.Collections.dialogs = new Entities.Collections.Dialogs();
  },

  checkSession(callback) {
    if ((new Date()).toISOString() > Session.expirationTime) {
      // recovery session
      if (Session.authParams.provider === 'facebook') {
        UserView.getFBStatus((token) => {
          Session.authParams.keys.token = token;

          self.createSession(Session.authParams, () => {
            callback();
          });
        });
      } else if (Session.authParams.provider === 'firebase_phone') {
        self.getFirebasePhone(() => {
          callback();
        });
      } else {
        self.createSession(Session.decrypt(Session.authParams), () => {
          callback();
        });

        Session.encrypt(Session.authParams);
      }
    } else {
      callback();
    }
  },

  createSession(params, callback) {
    // Remove coordinates from localStorage
    Location.toggleGeoCoordinatesToLocalStorage(false, (res, err) => {
      Helpers.log(err || res);
    });

    QB.createSession(params, (err, res) => {
      let errMsg;
      let parseErr;

      if (err) {
        Helpers.log(err);

        parseErr = err.detail;

        if (err.code === 401) {
          errMsg = QMCONFIG.errors.unauthorized;
          $('section:visible input:not(:checkbox)').addClass('is-error');
        } else {
          /* eslint-disable prefer-destructuring */
          if (parseErr.errors.email) {
            errMsg = parseErr.errors.email[0];
          } else if (parseErr.errors.base) {
            errMsg = parseErr.errors.base[0];
          } else {
            errMsg = parseErr.errors[0];
          }
          /* eslint-enable prefer-destructuring */

          // This checking is needed when your user has exited from Facebook
          // and you try to relogin on a project via FB without reload the page.
          // All you need it is to get the new FB user status
          // and show specific error message
          if (errMsg.indexOf('Authentication') >= 0) {
            errMsg = QMCONFIG.errors.crashFBToken;
            UserView.getFBStatus();

            // This checking is needed when you trying to connect via FB
            // and your primary email has already been taken on the project
          } else if (errMsg.indexOf('already') >= 0) {
            errMsg = QMCONFIG.errors.emailExists;
            UserView.getFBStatus();
          } else {
            errMsg = QMCONFIG.errors.session;
          }
        }

        fail(errMsg);
      } else {
        Helpers.log('QB SDK: Session is created', res);

        if (Session.token) {
          Session.update({
            token: res.token,
          });
        } else {
          Session.create({
            token: res.token,
            authParams: Session.encrypt(params),
          });
        }

        Session.update({
          date: new Date(),
        });

        callback(res);
      }
    });
  },

  loginUser(params, callback) {
    this.checkSession(() => {
      QB.login(params, (err, res) => {
        if (res && !err) {
          Helpers.log('QB SDK: User has logged', res);

          Session.update({
            date: new Date(),
            authParams: Session.encrypt(params),
          });

          if (typeof callback === 'function') {
            callback(res);
          }
        } else {
          Helpers.log(err);

          window.location.reload();
        }
      });
    });
  },

  getFirebasePhone(callback) {
    self.createSession({}, (session) => {
      QB.login(Session.authParams, (err, user) => {
        if (user && !err) {
          Session.update({
            date: new Date(),
            authParams: Session.encrypt(Session.authParams),
          });

          callback(session);
        } else {
          UserView.logInFirebase((authParams) => {
            self.loginUser(authParams);
          });
        }
      });
    });
  },

  logoutUser(callback) {
    Helpers.log('QB SDK: User has exited');
    // reset QuickBlox JS SDK after autologin via an existing token
    QB.service.qbInst.config.creds = QMCONFIG.qbAccount;
    clearTimeout(timer);
    Session.destroy();
    callback();
  },

  forgotPassword(email, callback) {
    this.checkSession(() => {
      QB.users.resetPassword(email, (error) => {
        if (error && error.code === 404) {
          Helpers.log(error.message);

          failForgot();
        } else {
          Helpers.log('QB SDK: Instructions have been sent');

          Session.destroy();
          callback();
        }
      });
    });
  },

  listUsers(params, callback) {
    this.checkSession(() => {
      QB.users.listUsers(params, (err, res) => {
        const responseIds = [];
        let requestIds;

        if (err) {
          Helpers.log(err.detail);
        } else {
          Helpers.log('QB SDK: Users are found', res);

          Session.update({
            date: new Date(),
          });

          if (params.filter && params.filter.value) {
            requestIds = params.filter.value.split(',').map(Number);

            res.items.forEach((item) => {
              responseIds.push(item.user.id);
            });

            ContactList.cleanUp(requestIds, responseIds);
          }

          callback(res);
        }
      });
    });
  },

  getUser(params, callback) {
    this.checkSession(() => {
      QB.users.get(params, (err, res) => {
        if (err && err.code === 404) {
          Helpers.log(err.message);

          failSearch();
          /** emulate right answer from a server */
          callback({
            current_page: 1,
            items: [],
          });
        } else {
          Helpers.log('QB SDK: User is found', res);

          Session.update({
            date: new Date(),
          });

          callback(res);
        }
      });
    });
  },

  updateUser(id, params, callback) {
    this.checkSession(() => {
      QB.users.update(id, params, (err, res) => {
        if (err) {
          Helpers.log(err.detail);

          callback(null, err);
        } else {
          Helpers.log('QB SDK: User is updated', res);

          Session.update({
            date: new Date(),
          });

          callback(res);
        }
      });
    });
  },

  createBlob(params, callback) {
    this.checkSession(() => {
      QB.content.createAndUpload(params, (err, res) => {
        if (err) {
          Helpers.log(err.detail);
        } else {
          Helpers.log('QB SDK: Blob is uploaded', res);

          Session.update({
            date: new Date(),
          });

          callback(res);
        }
      });
    });
  },

  connectChat(jid, callback) {
    this.checkSession(() => {
      const password = Session.token;

      QB.chat.connect({
        jid,
        password,
      }, (err, roster) => {
        if (err) {
          Helpers.log(err);

          fail(err.detail);
        } else {
          Listeners.stateActive = true;
          Listeners.setChatState(true);

          Session.update({
            date: new Date(),
          });

          ContactList.saveRoster(roster);

          setRecoverySessionInterval();

          callback();
        }
      });
    });
  },

  disconnectChat() {
    this.checkSession(() => {
      Listeners.stateActive = false;

      QB.chat.disconnect();
      DialogView.hideDialogs();

      Entities.active = '';
      Entities.Collections.dialogs = undefined;
      // init the new dialog's collection
      Entities.Collections.dialogs = new Entities.Collections.Dialogs();
    });
  },

  listDialogs(params, callback) {
    this.checkSession(() => {
      QB.chat.dialog.list(params, (err, res) => {
        if (err) {
          Helpers.log(err.detail);

          callback(err);
        } else {
          Helpers.log('QB SDK: Dialogs is found', res);

          Session.update({
            date: new Date(),
          });

          callback(null, res);
        }
      });
    });
  },

  createDialog(params, callback) {
    this.checkSession(() => {
      QB.chat.dialog.create(params, (err, res) => {
        if (err) {
          Helpers.log(err.detail);
        } else {
          Helpers.log('QB SDK: Dialog is created', res);

          Session.update({
            date: new Date(),
          });

          callback(res);
        }
      });
    });
  },

  updateDialog(id, params, callback) {
    this.checkSession(() => {
      QB.chat.dialog.update(id, params, (err, res) => {
        if (err) {
          Helpers.log(err.detail);
        } else {
          Helpers.log('QB SDK: Dialog is updated', res);

          Session.update({
            date: new Date(),
          });

          callback(res);
        }
      });
    });
  },

  deleteDialog(id, callback) {
    this.checkSession(() => {
      QB.chat.dialog.delete(id, (err, res) => {
        if (err) {
          Helpers.log(err.detail);
        } else {
          Helpers.log('QB SDK: Dialog is deleted', res);

          Session.update({
            date: new Date(),
          });

          callback(res);
        }
      });
    });
  },

  listMessages(params, callback) {
    this.checkSession(() => {
      QB.chat.message.list(params, (err, res) => {
        if (err) {
          Helpers.log(err.detail);
          callback(null, err);
        } else {
          Helpers.log('QB SDK: Messages is found', res);

          Session.update({
            date: new Date(),
          });

          callback(res.items);
        }
      });
    });
  },

  deleteMessage(params, callback) {
    this.checkSession(() => {
      QB.chat.message.delete(params, (response) => {
        if (response.code === 404) {
          Helpers.log(response.message);
        } else {
          Helpers.log('QB SDK: Message is deleted');

          Session.update({
            date: new Date(),
          });

          callback();
        }
      });
    });
  },

  sendPushNotification(calleeId, fullName) {
    const params = {
      notification_type: 'push',
      environment: 'production',
      message: QB.pushnotifications.base64Encode(`${fullName} is calling you.`),
      user: { ids: [calleeId] },
      ios_badge: '1',
      ios_sound: 'default',
    };

    QB.pushnotifications.events.create(params, (err, response) => {
      if (err) {
        Helpers.log('Create event error: ', err);
      } else {
        Helpers.log('Create event: ', response);
      }
    });
  },

  getContactList(callback) {
    QB.chat.roster.get((roster) => {
      callback(roster);
    });
  },

};

/* Private
---------------------------------------------------------------------- */
function setRecoverySessionInterval() {
// update QB session every one hour
  timer = setTimeout(() => {
    QB.getSession((err) => {
      if (err) {
        Helpers.log('recovery session error', err);

        return;
      }

      Session.update({
        date: new Date(),
      });

      setRecoverySessionInterval();
    });
  }, 3600 * 1000);
}

fail = function(errMsg) {
  UserView.removeSpinner();
  $('section:visible .text_error').addClass('is-error').text(errMsg);
  $('section:visible input:password').val('');
};

failForgot = function() {
  const errMsg = QMCONFIG.errors.notFoundEmail;

  $('section:visible input[type="email"]').addClass('is-error');
  fail(errMsg);
};

failSearch = function() {
  $('.popup:visible .note').removeClass('is-hidden').siblings('.popup-elem').addClass('is-hidden');
  ContactListView.removeDataSpinner();
};

export default QBApiCalls;
