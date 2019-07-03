'use strict';

const $ = require('jquery');
const _ = require('underscore');
const QMCONFIG = require('config');
const Helpers = require('Helpers');
const FirebaseWidget = require('FirebaseWidget');
const Person = require('models/person');
const ProfileView = require('views/profile');
const ChangePassView = require('views/change_password');
const FBImportView = require('views/fb_import');

/*
 * Q-municate chat application
 *
 * User Module
 *
 */
let self;
let tempParams;
let isFacebookCalled;

function User(app) {
    this.app = app;
    this.isImport = null;
    this.valid = false;
    self = this;
}

User.prototype = {

    initProfile() {
        const currentUser = new Person(_.clone(self.contact), {
            app: self.app,
            parse: true,
        });

        const profileView = new ProfileView({
            model: currentUser,
        });

        const changePassView = new ChangePassView({
            model: currentUser,
        });

        const fbImportView = new FBImportView();

        self.app.views.Profile = profileView;
        self.app.views.ChangePass = changePassView;
        self.app.views.FBImport = fbImportView;
    },

    reLogInFirebasePhone(callback) {
        FirebaseWidget.init();

        firebase.auth().onAuthStateChanged((user) => {
            if (user) {
                self.logInFirebasePhone(user, (authParams) => {
                    callback(authParams);
                });
            } else {
                callback();
            }
        });
    },

    logInFirebasePhone(user, callback) {
        user.getIdToken().then((idToken) => {
            const authParams = {
                provider: 'firebase_phone',
                firebase_phone: {
                    access_token: idToken,
                    project_id: QMCONFIG.firebase.projectId,
                },
            };

            self.providerConnect(authParams);

            if (typeof callback === 'function') {
                callback(authParams);
            }
        });
    },

    logInFacebook() {
        if (isFacebookCalled) {
            return;
        }
        isFacebookCalled = true;


        // NOTE!! You should use FB.login method instead FB.getLoginStatus
        // and your browser won't block FB Login popup
        FB.login((response) => {
            if (response.authResponse && response.status === 'connected') {
                self.connectFB(response.authResponse.accessToken);

                isFacebookCalled = false;
                Helpers.log('FB authResponse', response);
            } else {
                isFacebookCalled = false;
                Helpers.log('User cancelled login or did not fully authorize.');
            }
        }, {
            scope: QMCONFIG.fbAccount.scope,
        });
    },

    connectFB(token) {
        self.providerConnect({
            provider: 'facebook',
            keys: { token },
        });
    },

    providerConnect(params) {
        const QBApiCalls = self.app.service;
        const UserView = self.app.views.User;
        const DialogView = self.app.views.Dialog;
        const { Contact } = self.app.models;

        UserView.loginQB();
        UserView.createSpinner();

        if (params.provider === 'facebook') {
            QBApiCalls.createSession(params, (session) => {
                QBApiCalls.getUser(session.user_id, (user) => {
                    prepareChat(user, true);
                });
            });
        } else {
            QBApiCalls.createSession({}, () => {
                QBApiCalls.loginUser(params, (user) => {
                    prepareChat(user);
                });
            });
        }

        function prepareChat(user, isFB) {
            self.contact = Contact.create(user);
            self.isImport = getImport(user);

            Helpers.log('User', self);

            UserView.successFormCallback();

            QBApiCalls.connectChat(self.contact.user_jid, () => {
                self.rememberMe();
                DialogView.prepareDownloading();
                DialogView.downloadDialogs();

                if (!self.isImport && isFB) {
                    self.import(user);
                }

                if (self.contact.full_name === 'Unknown user') {
                    self.app.views.Profile.render().openPopup();
                }
            });
        }
    },

    import(user) {
        const DialogView = this.app.views.Dialog;
        let isFriendsPermission = false;

        FB.api('/me/permissions', (response) => {
            Helpers.log('FB Permissions', response);

            response.data.forEach((item) => {
                if (item.permission === 'user_friends' && item.status === 'granted') {
                    isFriendsPermission = true;
                }
            });

            if (isFriendsPermission) {
                // import FB friends
                FB.api('/me/friends', (res) => {
                    const ids = [];

                    Helpers.log('FB friends', res);

                    res.data.forEach((item) => {
                        ids.push(item.id);
                    });

                    if (ids.length > 0) {
                        DialogView.downloadDialogs(ids);
                    } else {
                        DialogView.downloadDialogs();
                    }
                });
            } else {
                DialogView.downloadDialogs();
            }
            self.isImport = '1';
            self.updateQBUser(user);
        });
    },

    updateQBUser(user) {
        const QBApiCalls = this.app.service;
        let customData;

        try {
            customData = JSON.parse(user.custom_data) || {};
        } catch (err) {
            customData = {};
        }

        customData.is_import = '1';
        customData = JSON.stringify(customData);
        QBApiCalls.updateUser(user.id, {
            custom_data: customData,
        }, () => {

        });
    },

    signup() {
        const QBApiCalls = this.app.service;
        const UserView = this.app.views.User;
        const DialogView = this.app.views.Dialog;
        const { Contact } = this.app.models;
        const form = $('section:visible form');
        let params;

        if (validate(form, this)) {
            UserView.createSpinner();

            params = {
                full_name: tempParams.full_name,
                email: tempParams.email,
                password: tempParams.password,
                tag_list: 'web',
            };

            QBApiCalls.createSession({}, () => {
                QBApiCalls.createUser(params, () => {
                    delete params.full_name;
                    delete params.tag_list;

                    QBApiCalls.loginUser(params, (user) => {
                        self.contact = Contact.create(user);

                        Helpers.log('User', self);

                        UserView.successFormCallback();

                        QBApiCalls.connectChat(self.contact.user_jid, () => {
                            if (tempParams.blob) {
                                self.uploadAvatar();
                            } else {
                                DialogView.prepareDownloading();
                                DialogView.downloadDialogs();
                            }
                        });
                    });
                });
            });
        }
    },

    uploadAvatar() {
        const QBApiCalls = this.app.service;
        const UserView = this.app.views.User;
        const DialogView = this.app.views.Dialog;
        const { Attach } = this.app.models;
        let customData;

        Attach.crop(tempParams.blob, {
            w: 1000,
            h: 1000,
        }, (file) => {
            QBApiCalls.createBlob({
                file,
                public: true,
            }, (blob) => {
                self.contact.blob_id = blob.id;
                self.contact.avatar_url = blob.path;

                UserView.successFormCallback();
                DialogView.prepareDownloading();
                DialogView.downloadDialogs();

                customData = JSON.stringify({
                    avatar_url: blob.path,
                });
                QBApiCalls.updateUser(self.contact.id, {
                    blob_id: blob.id,
                    custom_data: customData,
                }, () => {

                });
            });
        });
    },

    login() {
        const QBApiCalls = this.app.service;
        const UserView = this.app.views.User;
        const DialogView = this.app.views.Dialog;
        const { Contact } = this.app.models;
        const form = $('section:visible form');
        let params;

        if (validate(form, this)) {
            UserView.createSpinner();

            params = {
                email: tempParams.email,
                password: tempParams.password,
            };

            QBApiCalls.createSession(params, (session) => {
                QBApiCalls.getUser(session.user_id, (user) => {
                    self.contact = Contact.create(user);

                    Helpers.log('User', self);

                    UserView.successFormCallback();

                    QBApiCalls.connectChat(self.contact.user_jid, () => {
                        self.rememberMe();
                        DialogView.prepareDownloading();
                        DialogView.downloadDialogs();
                    });
                });
            });
        }
    },

    rememberMe() {
        const storage = {};

        Object.keys(self.contact).forEach((prop) => {
            if (prop !== 'app') {
                storage[prop] = self.contact[prop];
            }
        });

        localStorage.setItem('QM.user', JSON.stringify(storage));
    },

    forgot() {
        const QBApiCalls = this.app.service;
        const UserView = this.app.views.User;
        const form = $('section:visible form');

        if (validate(form, this)) {
            UserView.createSpinner();

            QBApiCalls.createSession({}, () => {
                QBApiCalls.forgotPassword(tempParams.email, () => {
                    UserView.successSendEmailCallback();
                    self.valid = false;
                });
            });
        }
    },

    autologin(callback) {
        const QBApiCalls = this.app.service;
        const UserView = this.app.views.User;
        const DialogView = this.app.views.Dialog;
        const { Contact } = this.app.models;
        const storage = JSON.parse(localStorage['QM.user']);

        UserView.createSpinner();

        QBApiCalls.getUser(storage.id, (user) => {
            if (user) {
                self.contact = Contact.create(user);
            } else {
                self.contact = Contact.create(storage);
            }

            Helpers.log('User', user);

            UserView.successFormCallback();

            QBApiCalls.connectChat(self.contact.user_jid, () => {
                self.rememberMe();
                DialogView.prepareDownloading();
                DialogView.downloadDialogs();

                if (typeof callback === 'function') {
                    callback();
                }
            });
        });
    },

    logout() {
        const QBApiCalls = self.app.service;

        QBApiCalls.disconnectChat();

        QBApiCalls.logoutUser(() => {
            localStorage.removeItem('QM.user');
            self.contact = null;
            self.valid = false;

            localStorage.clear();
            window.location.reload();
        });
    },

};

/* Private
---------------------------------------------------------------------- */
function validate(form, user) {
    const maxSize = QMCONFIG.maxLimitFile * 1024 * 1024;
    let file = form.find('input:file')[0];
    let fieldName;
    let errName;
    let value;
    let errMsg;

    tempParams = {};
    form.find('input:not(:file, :checkbox)').each(function() {
        // fix requeired pattern
        this.value = this.value.trim();

        /* eslint-disable prefer-destructuring */
        fieldName = this.id.split('-')[1];
        errName = this.placeholder;
        value = this.value;
        /* eslint-enable prefer-destructuring */

        if (this.checkValidity()) {
            user.valid = true;
            tempParams[fieldName] = value;
        } else {
            if (this.validity.valueMissing) {
                errMsg = `${errName} is required`;
            } else if (this.validity.typeMismatch) {
                this.value = '';
                errMsg = QMCONFIG.errors.invalidEmail;
            } else if (this.validity.patternMismatch && errName === 'Name') {
                if (value.length < 3) {
                    errMsg = QMCONFIG.errors.shortName;
                } else if (value.length > 50) {
                    errMsg = QMCONFIG.errors.bigName;
                } else {
                    errMsg = QMCONFIG.errors.invalidName;
                }
            } else if (this.validity.patternMismatch && (errName === 'Password' || errName === 'New password')) {
                if (value.length < 8) {
                    errMsg = QMCONFIG.errors.shortPass;
                } else if (value.length > 40) {
                    errMsg = QMCONFIG.errors.bigPass;
                } else {
                    errMsg = QMCONFIG.errors.invalidPass;
                }
            }

            fail(user, errMsg);
            $(this).addClass('is-error').focus();
        }
    });

    if (user.valid && file && file.files[0]) {
        file = file.files[0]; // eslint-disable-line prefer-destructuring

        if (file.type.indexOf('image/') === -1) {
            errMsg = QMCONFIG.errors.avatarType;
            fail(user, errMsg);
        } else if (file.name.length > 100) {
            errMsg = QMCONFIG.errors.fileName;
            fail(user, errMsg);
        } else if (file.size > maxSize) {
            errMsg = QMCONFIG.errors.fileSize;
            fail(user, errMsg);
        } else {
            tempParams.blob = file;
        }
    }

    return user.valid;
}

function fail(user, errMsg) {
    user.valid = false;
    $('section:visible .text_error').addClass('is-error').text(errMsg);
    $('section:visible input:password').val('');
    $('section:visible .chroma-hash label').css('background-color', 'rgb(255, 255, 255)');
}

function getImport(user) {
    let isImport;

    try {
        isImport = JSON.parse(user.custom_data).is_import || null;
    } catch (err) {
        isImport = null;
    }

    return isImport;
}

module.exports = User;
