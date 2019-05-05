/*
 * Q-municate chat application
 *
 * Contact List Module
 *
 */
define([
    'config',
    'underscore',
    'Helpers'
], function (
    QMCONFIG,
    _,
    Helpers
) {
    var contactIds;
    var isExistingRequest;

    function ContactList(app) {
        this.app = app;
        this.roster = {};
        this.contacts = getContacts();
        contactIds = Object.keys(this.contacts).map(Number);
    }

    ContactList.prototype = {

        saveRoster: function (roster) {
            this.roster = roster;
        },

        saveNotConfirmed: function (notConfirmed) {
            localStorage.setItem('QM.notConfirmed', JSON.stringify(notConfirmed));
        },

        saveHiddenDialogs: function (hiddenDialogs) {
            sessionStorage.setItem('QM.hiddenDialogs', JSON.stringify(hiddenDialogs));
        },

        add: function (occupantsIds, dialog, callback, subscribe) {
            var QBApiCalls = this.app.service;
            var Contact = this.app.models.Contact;
            var self = this;
            var newIds;
            var params;

            // TODO: need to make optimization here
            // (for new device the user will be waiting very long
            // time if he has a lot of private dialogs)
            newIds = [].concat(_.difference(occupantsIds, contactIds));
            contactIds = contactIds.concat(newIds);
            localStorage.setItem('QM.contacts', contactIds.join());
            if (subscribe) newIds = occupantsIds;

            if (newIds.length > 0) {
                params = {
                    filter: {
                        field: 'id',
                        param: 'in',
                        value: newIds
                    },
                    per_page: 100
                };

                QBApiCalls.listUsers(params, function (users) {
                    users.items.forEach(function (qbUser) {
                        var user = qbUser.user;
                        var contact = Contact.create(user);

                        self.contacts[user.id] = contact;
                        localStorage.setItem('QM.contact-' + user.id, JSON.stringify(contact));
                    });

                    Helpers.log('Contact List is updated', self);
                    callback(dialog);
                });
            } else {
                callback(dialog);
            }
        },

        cleanUp: function (requestIds, responseIds) {
            var ids = _.difference(requestIds, responseIds);

            ids.forEach(function (id) {
                localStorage.removeItem('QM.contact-' + id);
            });

            contactIds = _.difference(contactIds, ids);
            localStorage.setItem('QM.contacts', contactIds.join());
        },

        globalSearch: function (callback) {
            var self = this;
            var QBApiCalls = this.app.service;
            var val;
            var page;
            var contacts;

            if (isExistingRequest) {
                return;
            }

            val = sessionStorage['QM.search.value'];
            page = sessionStorage['QM.search.page'];

            isExistingRequest = true;

            QBApiCalls.getUser({
                full_name: val,
                page: page,
                per_page: 20
            }, function (data) {
                isExistingRequest = false;

                if (data.items.length) {
                    contacts = self.getResults(data.items);
                } else {
                    contacts = data.items;
                }

                page += 1;

                sessionStorage.setItem('QM.search.allPages', Math.ceil(data.total_entries / data.per_page));
                sessionStorage.setItem('QM.search.page', page);

                contacts.sort(function (first, second) {
                    var a = first.full_name.toLowerCase();
                    var b = second.full_name.toLowerCase();
                    var res;

                    if (a < b) {
                        res = -1;
                    } else if (a > b) {
                        res = 1;
                    } else {
                        res = 0;
                    }

                    return res;
                });

                Helpers.log('Search results', contacts);

                callback(contacts);
            });
        },

        getResults: function (data) {
            var Contact = this.app.models.Contact;
            var User = this.app.models.User;
            var contacts = [];
            var contact;

            data.forEach(function (item) {
                if (item.user.id !== User.contact.id) {
                    contact = Contact.create(item.user);
                    contacts.push(contact);
                }
            });

            return contacts;
        },

        getFBFriends: function (ids, callback) {
            var QBApiCalls = this.app.service;
            var Contact = this.app.models.Contact;
            var self = this;
            var newIds = [];
            var params;

            // TODO: duplicate of add() function
            params = {
                filter: {
                    field: 'facebook_id',
                    param: 'in',
                    value: ids
                }
            };

            QBApiCalls.listUsers(params, function (users) {
                users.items.forEach(function (qbUser) {
                    var user = qbUser.user;
                    var contact = Contact.create(user);
                    newIds.push(user.id);
                    self.contacts[user.id] = contact;
                    localStorage.setItem('QM.contact-' + user.id, JSON.stringify(contact));
                });

                contactIds = contactIds.concat(newIds);
                localStorage.setItem('QM.contacts', contactIds.join());

                Helpers.log('Contact List is updated', self);
                callback(newIds);
            });
        }

    };

    /* Private
    ---------------------------------------------------------------------- */
    // Creation of Contact List from cache
    function getContacts() {
        var contacts = {};
        var ids = localStorage['QM.contacts'] ? localStorage['QM.contacts'].split(',') : [];
        var len;
        var i;

        if (ids.length > 0) {
            try {
                for (i = 0, len = ids.length; i < len; i++) {
                    contacts[ids[i]] = typeof localStorage['QM.contact-' + ids[i]] !== 'undefined'
                        ? JSON.parse(localStorage['QM.contact-' + ids[i]])
                        : true;

                    if (contacts[ids[i]] === true) {
                        delete contacts[ids[i]];
                    }
                }
            } catch (e) {
                Helpers.log('Error getting contacts from cache. Clearing...');
                localStorage.clear();
                contacts = {};
            }
        }

        return contacts;
    }

    return ContactList;
});
