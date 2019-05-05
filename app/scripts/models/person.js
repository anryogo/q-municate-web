/*
 * Q-municate chat application
 *
 * Person Model
 *
 */
define([
    'jquery',
    'underscore',
    'backbone',
    'config',
    'Helpers'
], function (
    $,
    _,
    Backbone,
    QMCONFIG,
    Helpers
) {
    var App;

    return Backbone.Model.extend({
        defaults: {
            full_name: null,
            email: null,
            password: '',
            phone: '',
            facebook_id: null,
            is_provider: null,
            avatar: null,
            avatar_url: QMCONFIG.defAvatar.url,
            status: '',
            user_tags: null
        },

        validate: function (attrs) {
            var MAX_SIZE = QMCONFIG.maxLimitFile * 1024 * 1024;

            // Field: full_name
            // mandatory; 3-200 characters;
            if (!attrs.full_name) {
                return 'Name is required';
            }
            if (attrs.full_name === 'Unknown user') {
                return QMCONFIG.errors.unknownUserName;
            }
            if (attrs.full_name.length < 3) {
                return QMCONFIG.errors.shortName;
            }
            if (attrs.full_name.length > 200) {
                return QMCONFIG.errors.bigName;
            }

            // Field: password
            // mustn’t contain non-Latin characters and spaces; 8-40 characters
            if (attrs.password) {
                if (!/^[\w!"#$%&'()*+,\-./:;<=>?@[\\\]^`{|}~]+$/.test(attrs.password)) {
                    return QMCONFIG.errors.invalidPass;
                }
                if (attrs.password.length < 8) {
                    return QMCONFIG.errors.shortPass;
                }
            }

            // Field: avatar
            // only image file; not more than 10 MB; filename not more than 100 characters
            if (attrs.avatar) {
                if (!/^image.*$/.test(attrs.avatar.type)) {
                    return QMCONFIG.errors.avatarType;
                }
                if (attrs.avatar.size > MAX_SIZE) {
                    return QMCONFIG.errors.fileSize;
                }
                if (attrs.avatar.name.length > 100) {
                    return QMCONFIG.errors.fileName;
                }
            }

            return '';
        },

        parse: function (data, options) {
            if (typeof options === 'object') {
                App = options.app;
            }

            _.each(data, function (val, key) {
                var isHasKey = _.has(this.defaults, key);
                if (key !== 'id' && !isHasKey) {
                    delete data[key];
                } else if (typeof val === 'string') {
                    data[key] = val.trim();
                }
            }, this);

            return data;
        },

        initialize: function () {

        },

        update: function () {
            var currentUser = App.models.User.contact;
            var QBApiCalls = App.service;
            var data = this.toJSON();
            var params = {};
            var customData = (currentUser.custom_data && JSON.parse(currentUser.custom_data)) || {};
            var self = this;

            if (Object.keys(data).length === 0 || (Object.keys(data).length === 1 && Object.keys(data)[0] === 'avatar' && !data.avatar)) return;

            if (data.full_name) {
                currentUser.full_name = data.full_name;
                params.full_name = data.full_name;
            }
            if (data.phone) {
                currentUser.phone = data.phone;
                params.phone = data.phone;
            }
            if (data.status.length >= 0) {
                currentUser.status = data.status;
                customData.status = data.status;
                currentUser.custom_data = JSON.stringify(customData);
                params.custom_data = JSON.stringify(customData);
            }
            if (data.avatar) {
                this.uploadAvatar(data.avatar, function (blob) {
                    var avatarUrl = QB.content.publicUrl(blob.uid);

                    self.set('avatar_url', avatarUrl);

                    currentUser.blob_id = blob.id;
                    params.blob_id = blob.id;
                    currentUser.avatar_url = avatarUrl;
                    customData.avatar_url = avatarUrl;
                    currentUser.custom_data = JSON.stringify(customData);
                    params.custom_data = JSON.stringify(customData);

                    $('.profileUserName[data-id="' + currentUser.id + '"]').text(currentUser.full_name);
                    $('.profileUserAvatar[data-id="' + currentUser.id + '"]').css('background-image', 'url(' + currentUser.avatar_url + ')');
                    App.models.User.rememberMe();

                    QBApiCalls.updateUser(currentUser.id, params, function (res) {
                        Helpers.log('update of user', res);
                    });
                });
            } else {
                $('.profileUserName[data-id="' + currentUser.id + '"]').text(currentUser.full_name);
                App.models.User.rememberMe();

                QBApiCalls.updateUser(currentUser.id, params, function (res) {
                    Helpers.log('update of user', res);
                });
            }
        },

        uploadAvatar: function (avatar, callback) {
            var QBApiCalls = App.service;
            var Attach = App.models.Attach;

            Attach.crop(avatar, {
                w: 1000,
                h: 1000
            }, function (file) {
                QBApiCalls.createBlob({
                    file: file,
                    public: true
                }, function (blob) {
                    callback(blob);
                });
            });
        },

        changeQBPass: function (data, callback) {
            var currentUser = App.models.User.contact;
            var Session = App.models.Session;
            var QBApiCalls = App.service;
            var params = {};
            var self = this;

            params.old_password = data.oldPass;
            params.password = data.newPass;

            QBApiCalls.updateUser(currentUser.id, params, function (res, err) {
                if (res) {
                    Helpers.log('update of user', res);
                    Session.update({
                        authParams: Session.encrypt({
                            email: currentUser.email,
                            password: params.password
                        })
                    }, true);
                    self.set('password', '');
                    callback(null, res);
                } else {
                    callback(err, null);
                }
            });
        },

        connectFB: function (fbId, callback) {
            var currentUser = App.models.User.contact;
            var QBApiCalls = App.service;
            var customData = (currentUser.custom_data && JSON.parse(currentUser.custom_data)) || {};
            var params = {};
            var self = this;

            if (self.get('avatar_url') === QMCONFIG.defAvatar.url) {
                customData.avatar_url = 'https://graph.facebook.com/v3.0/' + fbId + '/picture?width=1200&height=1200';
            }
            customData.is_import = '1';
            params.facebook_id = fbId;
            params.custom_data = JSON.stringify(customData);

            QBApiCalls.updateUser(currentUser.id, params, function (res, err) {
                if (res) {
                    Helpers.log('update of user', res);

                    if (self.get('avatar_url') === QMCONFIG.defAvatar.url) {
                        self.set('avatar_url', customData.avatar_url);
                        currentUser.avatar_url = customData.avatar_url;
                    }
                    self.set('facebook_id', fbId);
                    currentUser.facebook_id = fbId;
                    currentUser.custom_data = params.custom_data;

                    $('.profileUserAvatar[data-id="' + currentUser.id + '"]').css('background-image', 'url(' + currentUser.avatar_url + ')');
                    App.models.User.rememberMe();

                    // import friends
                    self.getFBFriends();

                    callback(null, res);
                } else {
                    callback(err, null);
                }
            });
        },

        getFBFriends: function () {
            var isFriendsPermission = false;
            var self = this;

            FB.api('/me/permissions', function (response) {
                var len;
                var i;

                Helpers.log('FB Permissions', response);
                for (i = 0, len = response.data.length; i < len; i++) {
                    if (response.data[i].permission === 'user_friends' && response.data[i].status === 'granted') {
                        isFriendsPermission = true;
                    }
                }

                if (isFriendsPermission) {
                    // import FB friends
                    FB.api('/me/friends', function (res) {
                        var ids = [];

                        Helpers.log('FB friends', res);

                        for (i = 0, len = res.data.length; i < len; i++) {
                            ids.push(res.data[i].id);
                        }

                        if (ids.length > 0) {
                            self.import(ids);
                        }
                    });
                }
            });
        },

        import: function (ids) {
            var ContactList = App.models.ContactList;
            var ContactListView = App.views.ContactList;
            var FBImport = App.views.FBImport;

            ContactList.getFBFriends(ids, function (newIds) {
                var len;
                var i;

                for (i = 0, len = newIds.length; i < len; i++) {
                    ContactListView.importFBFriend(newIds[i]);
                }
                FBImport.render().openPopup();
            });
        }

    });
});
