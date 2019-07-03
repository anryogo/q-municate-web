'use strict';

const _ = require('underscore');
const Helpers = require('Helpers');

/*
 * Q-municate chat application
 *
 * Contact List Module
 *
 */
let contactIds;
let isExistingRequest;

function ContactList(app) {
    this.app = app;
    this.roster = {};
    this.contacts = getContacts();
    contactIds = Object.keys(this.contacts).map(Number);
}

ContactList.prototype = {

    saveRoster(roster) {
        this.roster = roster;
    },

    saveNotConfirmed(notConfirmed) {
        localStorage.setItem('QM.notConfirmed', JSON.stringify(notConfirmed));
    },

    saveHiddenDialogs(hiddenDialogs) {
        sessionStorage.setItem('QM.hiddenDialogs', JSON.stringify(hiddenDialogs));
    },

    add(occupantsIds, dialog, callback, subscribe) {
        const QBApiCalls = this.app.service;
        const { Contact } = this.app.models;
        const self = this;
        let newIds;
        let params;

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
                    value: newIds,
                },
                per_page: 100,
            };

            QBApiCalls.listUsers(params, (users) => {
                users.items.forEach((qbUser) => {
                    const { user } = qbUser;
                    const contact = Contact.create(user);

                    self.contacts[user.id] = contact;
                    localStorage.setItem(`QM.contact-${user.id}`, JSON.stringify(contact));
                });

                Helpers.log('Contact List is updated', self);
                callback(dialog);
            });
        } else {
            callback(dialog);
        }
    },

    cleanUp(requestIds, responseIds) {
        const ids = _.difference(requestIds, responseIds);

        ids.forEach((id) => {
            localStorage.removeItem(`QM.contact-${id}`);
        });

        contactIds = _.difference(contactIds, ids);
        localStorage.setItem('QM.contacts', contactIds.join());
    },

    globalSearch(callback) {
        const self = this;
        const QBApiCalls = this.app.service;
        let page;
        let contacts;

        if (isExistingRequest) {
            return;
        }

        const val = sessionStorage['QM.search.value'];
        page = sessionStorage['QM.search.page'];

        isExistingRequest = true;

        QBApiCalls.getUser({
            full_name: val,
            page,
            per_page: 20,
        }, (data) => {
            isExistingRequest = false;

            if (data.items.length) {
                contacts = self.getResults(data.items);
            } else {
                contacts = data.items;
            }

            page += 1;

            sessionStorage.setItem('QM.search.allPages', Math.ceil(data.total_entries / data.per_page));
            sessionStorage.setItem('QM.search.page', page);

            contacts.sort((first, second) => {
                const a = first.full_name.toLowerCase();
                const b = second.full_name.toLowerCase();
                let res;

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

    getResults(data) {
        const { Contact } = this.app.models;
        const { User } = this.app.models;
        const contacts = [];
        let contact;

        data.forEach((item) => {
            if (item.user.id !== User.contact.id) {
                contact = Contact.create(item.user);
                contacts.push(contact);
            }
        });

        return contacts;
    },

    getFBFriends(ids, callback) {
        const QBApiCalls = this.app.service;
        const { Contact } = this.app.models;
        const self = this;
        const newIds = [];

        // TODO: duplicate of add() function
        const params = {
            filter: {
                field: 'facebook_id',
                param: 'in',
                value: ids,
            },
        };

        QBApiCalls.listUsers(params, (users) => {
            users.items.forEach((qbUser) => {
                const { user } = qbUser;
                const contact = Contact.create(user);
                newIds.push(user.id);
                self.contacts[user.id] = contact;
                localStorage.setItem(`QM.contact-${user.id}`, JSON.stringify(contact));
            });

            contactIds = contactIds.concat(newIds);
            localStorage.setItem('QM.contacts', contactIds.join());

            Helpers.log('Contact List is updated', self);
            callback(newIds);
        });
    },

};

/* Private
---------------------------------------------------------------------- */
// Creation of Contact List from cache
function getContacts() {
    let contacts = {};
    const ids = localStorage['QM.contacts'] ? localStorage['QM.contacts'].split(',') : [];

    if (ids.length > 0) {
        try {
            ids.forEach((item) => {
                contacts[item] = typeof localStorage[`QM.contact-${item}`] !== 'undefined'
                    ? JSON.parse(localStorage[`QM.contact-${item}`])
                    : true;

                if (contacts[item] === true) {
                    delete contacts[item];
                }
            });
        } catch (e) {
            Helpers.log('Error getting contacts from cache. Clearing...');
            localStorage.clear();
            contacts = {};
        }
    }

    return contacts;
}

module.exports = ContactList;
