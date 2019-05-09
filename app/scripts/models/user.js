/*
 * Q-municate chat application
 *
 * User Module
 *
 */
define([
    'jquery',
    'underscore',
    'config',
    'Helpers',
    'FirebaseWidget',
    'models/person',
    'views/profile',
    'views/change_password',
    'views/fb_import'
], function(
    $,
    _,
    QMCONFIG,
    Helpers,
    FirebaseWidget,
    Person,
    ProfileView,
    ChangePassView,
    FBImportView
) {
    var self;
    var tempParams;
    var isFacebookCalled;

    function User(app) {
        this.app = app;
        this.isImport = null;
        this.valid = false;
        self = this;
    }

    User.prototype = {

        initProfile: function() {
            var currentUser = new Person(_.clone(self.contact), {
                app: self.app,
                parse: true
            });

            var profileView = new ProfileView({
                model: currentUser
            });

            var changePassView = new ChangePassView({
                model: currentUser
            });

            var fbImportView = new FBImportView();

            self.app.views.Profile = profileView;
            self.app.views.ChangePass = changePassView;
            self.app.views.FBImport = fbImportView;
        },

        reLogInFirebasePhone: function(callback) {
            FirebaseWidget.init();

            firebase.auth().onAuthStateChanged(function(user) {
                if (user) {
                    self.logInFirebasePhone(user, function(authParams) {
                        callback(authParams);
                    });
                } else {
                    callback();
                }
            });
        },

        logInFirebasePhone: function(user, callback) {
            user.getIdToken().then(function(idToken) {
                var authParams = {
                    provider: 'firebase_phone',
                    firebase_phone: {
                        access_token: idToken,
                        project_id: QMCONFIG.firebase.projectId
                    }
                };

                self.providerConnect(authParams);

                if (typeof callback === 'function') {
                    callback(authParams);
                }
            });
        },

        logInFacebook: function() {
            if (isFacebookCalled) {
                return;
            }
            isFacebookCalled = true;


            // NOTE!! You should use FB.login method instead FB.getLoginStatus
            // and your browser won't block FB Login popup
            FB.login(function(response) {
                if (response.authResponse && response.status === 'connected') {
                    self.connectFB(response.authResponse.accessToken);

                    isFacebookCalled = false;
                    Helpers.log('FB authResponse', response);
                } else {
                    isFacebookCalled = false;
                    Helpers.log('User cancelled login or did not fully authorize.');
                }
            }, {
                scope: QMCONFIG.fbAccount.scope
            });
        },

        connectFB: function(token) {
            self.providerConnect({
                provider: 'facebook',
                keys: { token: token }
            });
        },

        providerConnect: function(params) {
            var QBApiCalls = self.app.service;
            var UserView = self.app.views.User;
            var DialogView = self.app.views.Dialog;
            var Contact = self.app.models.Contact;

            UserView.loginQB();
            UserView.createSpinner();

            if (params.provider === 'facebook') {
                QBApiCalls.createSession(params, function(session) {
                    QBApiCalls.getUser(session.user_id, function(user) {
                        prepareChat(user, true);
                    });
                });
            } else {
                QBApiCalls.createSession({}, function() {
                    QBApiCalls.loginUser(params, function(user) {
                        prepareChat(user);
                    });
                });
            }

            function prepareChat(user, isFB) {
                self.contact = Contact.create(user);
                self.isImport = getImport(user);

                Helpers.log('User', self);

                UserView.successFormCallback();

                QBApiCalls.connectChat(self.contact.user_jid, function() {
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

        import: function(user) {
            var DialogView = this.app.views.Dialog;
            var isFriendsPermission = false;

            FB.api('/me/permissions', function(response) {
                Helpers.log('FB Permissions', response);

                response.data.forEach(function(item) {
                    if (item.permission === 'user_friends' && item.status === 'granted') {
                        isFriendsPermission = true;
                    }
                });

                if (isFriendsPermission) {
                    // import FB friends
                    FB.api('/me/friends', function(res) {
                        var ids = [];

                        Helpers.log('FB friends', res);

                        res.data.forEach(function(item) {
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

        updateQBUser: function(user) {
            var QBApiCalls = this.app.service;
            var customData;

            try {
                customData = JSON.parse(user.custom_data) || {};
            } catch (err) {
                customData = {};
            }

            customData.is_import = '1';
            customData = JSON.stringify(customData);
            QBApiCalls.updateUser(user.id, {
                custom_data: customData
            }, function() {

            });
        },

        signup: function() {
            var QBApiCalls = this.app.service;
            var UserView = this.app.views.User;
            var DialogView = this.app.views.Dialog;
            var Contact = this.app.models.Contact;
            var form = $('section:visible form');
            var params;

            if (validate(form, this)) {
                UserView.createSpinner();

                params = {
                    full_name: tempParams.full_name,
                    email: tempParams.email,
                    password: tempParams.password,
                    tag_list: 'web'
                };

                QBApiCalls.createSession({}, function() {
                    QBApiCalls.createUser(params, function() {
                        delete params.full_name;
                        delete params.tag_list;

                        QBApiCalls.loginUser(params, function(user) {
                            self.contact = Contact.create(user);

                            Helpers.log('User', self);

                            UserView.successFormCallback();

                            QBApiCalls.connectChat(self.contact.user_jid, function() {
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

        uploadAvatar: function() {
            var QBApiCalls = this.app.service;
            var UserView = this.app.views.User;
            var DialogView = this.app.views.Dialog;
            var Attach = this.app.models.Attach;
            var customData;

            Attach.crop(tempParams.blob, {
                w: 1000,
                h: 1000
            }, function(file) {
                QBApiCalls.createBlob({
                    file: file,
                    public: true
                }, function(blob) {
                    self.contact.blob_id = blob.id;
                    self.contact.avatar_url = blob.path;

                    UserView.successFormCallback();
                    DialogView.prepareDownloading();
                    DialogView.downloadDialogs();

                    customData = JSON.stringify({
                        avatar_url: blob.path
                    });
                    QBApiCalls.updateUser(self.contact.id, {
                        blob_id: blob.id,
                        custom_data: customData
                    }, function() {

                    });
                });
            });
        },

        login: function() {
            var QBApiCalls = this.app.service;
            var UserView = this.app.views.User;
            var DialogView = this.app.views.Dialog;
            var Contact = this.app.models.Contact;
            var form = $('section:visible form');
            var params;

            if (validate(form, this)) {
                UserView.createSpinner();

                params = {
                    email: tempParams.email,
                    password: tempParams.password
                };

                QBApiCalls.createSession(params, function(session) {
                    QBApiCalls.getUser(session.user_id, function(user) {
                        self.contact = Contact.create(user);

                        Helpers.log('User', self);

                        UserView.successFormCallback();

                        QBApiCalls.connectChat(self.contact.user_jid, function() {
                            self.rememberMe();
                            DialogView.prepareDownloading();
                            DialogView.downloadDialogs();
                        });
                    });
                });
            }
        },

        rememberMe: function() {
            var storage = {};

            Object.keys(self.contact).forEach(function(prop) {
                if (prop !== 'app') {
                    storage[prop] = self.contact[prop];
                }
            });

            localStorage.setItem('QM.user', JSON.stringify(storage));
        },

        forgot: function() {
            var QBApiCalls = this.app.service;
            var UserView = this.app.views.User;
            var form = $('section:visible form');

            if (validate(form, this)) {
                UserView.createSpinner();

                QBApiCalls.createSession({}, function() {
                    QBApiCalls.forgotPassword(tempParams.email, function() {
                        UserView.successSendEmailCallback();
                        self.valid = false;
                    });
                });
            }
        },

        autologin: function(callback) {
            var QBApiCalls = this.app.service;
            var UserView = this.app.views.User;
            var DialogView = this.app.views.Dialog;
            var Contact = this.app.models.Contact;
            var storage = JSON.parse(localStorage['QM.user']);

            UserView.createSpinner();

            QBApiCalls.getUser(storage.id, function(user) {
                if (user) {
                    self.contact = Contact.create(user);
                } else {
                    self.contact = Contact.create(storage);
                }

                Helpers.log('User', user);

                UserView.successFormCallback();

                QBApiCalls.connectChat(self.contact.user_jid, function() {
                    self.rememberMe();
                    DialogView.prepareDownloading();
                    DialogView.downloadDialogs();

                    if (typeof callback === 'function') {
                        callback();
                    }
                });
            });
        },

        logout: function() {
            var QBApiCalls = self.app.service;

            QBApiCalls.disconnectChat();

            QBApiCalls.logoutUser(function() {
                localStorage.removeItem('QM.user');
                self.contact = null;
                self.valid = false;

                localStorage.clear();
                window.location.reload();
            });
        }

    };

    /* Private
    ---------------------------------------------------------------------- */
    function validate(form, user) {
        var maxSize = QMCONFIG.maxLimitFile * 1024 * 1024;
        var file = form.find('input:file')[0];
        var fieldName; var errName;
        var value; var
            errMsg;

        tempParams = {};
        form.find('input:not(:file, :checkbox)').each(function() {
            // fix requeired pattern
            this.value = this.value.trim();

            fieldName = this.id.split('-')[1];
            errName = this.placeholder;
            value = this.value;

            if (this.checkValidity()) {
                user.valid = true;
                tempParams[fieldName] = value;
            } else {
                if (this.validity.valueMissing) {
                    errMsg = errName + ' is required';
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
            file = file.files[0];

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
        var isImport;

        try {
            isImport = JSON.parse(user.custom_data).is_import || null;
        } catch (err) {
            isImport = null;
        }

        return isImport;
    }

    return User;
});
