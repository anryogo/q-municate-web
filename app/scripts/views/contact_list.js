'use strict';

const $ = require('jquery');
const _ = require('underscore');
const QB = require('quickblox');

require('malihu-custom-scrollbar-plugin');
require('jquery-mousewheel');

const QMCONFIG = require('config');
const Entities = require('../entities');
const Helpers = require('../helpers');

/*
 * Q-municate chat application
 *
 * Contact List View Module
 *
 */
let self;

let Dialog;
let Message;
let ContactList;
let User;

function ContactListView(app) {
    this.app = app;

    /* eslint-disable prefer-destructuring */
    Dialog = this.app.models.Dialog;
    Message = this.app.models.Message;
    ContactList = this.app.models.ContactList;
    User = this.app.models.User;
    self = this;
    /* eslint-enable prefer-destructuring */

    scrollbarContacts();
}

ContactListView.prototype = {

    createDataSpinner(list) {
        let spinnerBlock = '';

        this.removeDataSpinner();

        spinnerBlock += '<div class="popup-elem spinner_bounce">';
        spinnerBlock += '<div class="spinner_bounce-bounce1"></div>';
        spinnerBlock += '<div class="spinner_bounce-bounce2"></div>';
        spinnerBlock += '<div class="spinner_bounce-bounce3"></div>';
        spinnerBlock += '</div>';

        list.after(spinnerBlock);
    },

    removeDataSpinner() {
        $('.popup:visible .spinner_bounce').remove();
        $('.popup:visible input').prop('disabled', false);
    },

    globalPopup() {
        const popup = $('#popupSearch');

        openPopup(popup);
        popup.find('.popup-elem')
            .addClass('is-hidden')
            .siblings('form')
            .find('input')
            .val('');
        popup.find('.mCSB_container').empty();
    },

    globalSearch($form) {
        const that = this;
        const $popup = $form.parent();
        const $list = $popup.find('ul:first.list_contacts');
        const $firstNote = $popup.find('.j-start_search_note');
        const val = $form.find('input[type="search"]').val().trim();
        const len = val.length;

        if (len > 0) {
            $firstNote.addClass('is-hidden');
            // display "Name must be more than 2 characters" or "No results found"
            if (len < 3) {
                $popup.find('.popup-elem .not_found').addClass('is-hidden');
                $popup.find('.popup-elem .short_length').removeClass('is-hidden');
            } else {
                $popup.find('.popup-elem .not_found').removeClass('is-hidden');
                $popup.find('.popup-elem .short_length').addClass('is-hidden');
            }

            scrollbar($list, that);
            that.createDataSpinner($list);

            sessionStorage.setItem('QM.search.value', val);
            sessionStorage.setItem('QM.search.page', 1);

            ContactList.globalSearch((results) => {
                createListResults($list, results, that);
            });
        } else {
            $firstNote.removeClass('is-hidden');
        }

        $form.find('input').prop('disabled', false).val(val);
        $popup.find('.popup-elem').addClass('is-hidden');
        $popup.find('.mCSB_container').empty();

        $('.popup:visible .spinner_bounce')
            .removeClass('is-hidden')
            .addClass('is-empty');
    },

    addContactsToChat(objDom, type, dialogId, isPrivate) {
        const ids = objDom.data('ids') ? objDom.data('ids').toString().split(',') : [];
        const popup = $('#popupContacts');
        const { contacts } = ContactList;
        const { roster } = ContactList;
        let existingIds;
        let userId;
        let friends;
        let html;

        openPopup(popup, type, dialogId);
        popup.addClass('not-selected').removeClass('is-addition');
        popup.find('.note').addClass('is-hidden').siblings('ul').removeClass('is-hidden');
        popup.find('.popup-nofriends').addClass('is-hidden').siblings().removeClass('is-hidden');
        popup.find('form')[0].reset();
        popup.find('.list_contacts').mCustomScrollbar('scrollTo', 'top');
        popup.find('.mCSB_container').empty();
        popup.find('.btn').removeClass('is-hidden');

        // get your friends which are sorted by alphabet
        const sortedContacts = _.pluck(_.sortBy(contacts, (user) => {
            if (user.full_name) {
                return user.full_name.toLowerCase();
            }
            return user.full_name;
        }), 'id').map(String);

        friends = _.filter(sortedContacts, el => roster[el] && roster[el].subscription !== 'none');
        Helpers.log('Friends', friends);

        if (friends.length === 0) {
            popup.children(':not(.popup-header)').addClass('is-hidden');
            popup.find('.popup-nofriends').removeClass('is-hidden');
            return;
        }

        // exclude users who are already present in the dialog
        friends = _.difference(friends, ids);

        friends.forEach((item) => {
            userId = item;

            html = '';
            html += `<li class="list-item" data-id="${userId}">`;
            html += '<a class="contact l-flexbox" href="#">';
            html += '<div class="l-flexbox_inline">';
            html += `<div class="contact-avatar avatar profileUserAvatar" style="background-image:url(${contacts[userId].avatar_url})" data-id="${userId}"></div>`;
            html += `<span class="name profileUserName" data-id="${userId}">${contacts[userId].full_name}</span>`;
            html += '</div><input class="form-checkbox" type="checkbox">';
            html += '</a></li>';

            popup.find('.mCSB_container').append(html);
        });

        if (type || isPrivate) {
            existingIds = ids.length > 0 ? ids : null;
            popup.addClass('is-addition').data('existing_ids', existingIds);
        } else {
            popup.data('existing_ids', null);
        }
    },

    // subscriptions

    importFBFriend(id) {
        const jid = QB.chat.helpers.getUserJid(id, QMCONFIG.qbAccount.appId);
        const { roster } = ContactList;

        QB.chat.roster.add(jid, () => {
            // update roster
            roster[id] = {
                subscription: 'none',
                ask: 'subscribe',
            };
            ContactList.saveRoster(roster);

            Dialog.createPrivate(jid);
        });
    },

    sendSubscribe(jid, isChat, dialogId) {
        const MessageView = this.app.views.Message;
        const $objDom = $(`.list-item[data-jid="${jid}"]`);
        const { roster } = ContactList;
        const id = QB.chat.helpers.getIdFromNode(jid);
        const $dialogItem = $(`.dialog-item[data-id="${id}"]`);
        let dialogItem = $dialogItem[0];
        const requestItem = $(`#requestsList .list-item[data-jid="${jid}"]`);
        const notConfirmed = localStorage['QM.notConfirmed'] ? JSON.parse(localStorage['QM.notConfirmed']) : {};
        const time = Math.floor(Date.now() / 1000);
        let message;
        const that = this;

        if (notConfirmed[id] && requestItem.length) {
            changeRequestStatus('Request accepted');
            that.sendConfirm(jid, 'new_dialog');
        } else {
            if (!isChat) {
                changeRequestStatus('Request Sent');
            }

            if (dialogId) {
                if (!$dialogItem.length) {
                    Dialog.createPrivate(jid, 'new_dialog', dialogId);
                }
            } else {
                QB.chat.roster.add(jid, () => {
                    if ($dialogItem.length) {
                        // send notification about subscribe
                        sendContactRequest({
                            jid,
                            date_sent: time,
                            dialog_id: dialogItem.getAttribute('data-dialog'),
                            save_to_history: 1,
                            notification_type: '4',
                        });

                        message = Message.create({
                            date_sent: time,
                            chat_dialog_id: dialogItem.getAttribute('data-dialog'),
                            sender_id: User.contact.id,
                            notification_type: '4',
                            online: true,
                        });

                        MessageView.addItem(message, true, true);
                    } else {
                        Dialog.createPrivate(jid, true);
                    }
                });
            }
        }

        // update roster
        roster[id] = {
            subscription: 'none',
            ask: 'subscribe',
        };
        ContactList.saveRoster(roster);

        dialogItem = $(`.l-list-wrap section:not(#searchList) .dialog-item[data-id="${id}"]`);
        const copyDialogItem = dialogItem.clone();
        dialogItem.remove();
        $('#recentList ul').prepend(copyDialogItem);
        if ($('#searchList').is(':hidden')) {
            $('#recentList').removeClass('is-hidden');
            Helpers.Dialogs.isSectionEmpty($('.j-recentList'));
        }

        function changeRequestStatus(text) {
            const $buttonRequest = $objDom.find('.j-sendRequest');

            $buttonRequest.after(`<span class="send-request l-flexbox">${text}</span>`);
            $buttonRequest.remove();
        }
    },

    sendConfirm(jid, isClick) {
        const DialogView = this.app.views.Dialog;
        const $objDom = $(`.j-incomingContactRequest[data-jid="${jid}"]`);
        const id = QB.chat.helpers.getIdFromNode(jid);
        const $chat = $(`.l-chat[data-id="${id}"]`);
        let list = $objDom.parents('ul.j-requestsList');
        const { roster } = ContactList;
        const notConfirmed = localStorage['QM.notConfirmed'] ? JSON.parse(localStorage['QM.notConfirmed']) : {};
        const hiddenDialogs = JSON.parse(sessionStorage['QM.hiddenDialogs']);
        const time = Math.floor(Date.now() / 1000);
        const { dialogs } = Entities.Collections;
        let dialogItem;

        $objDom.remove();

        Helpers.Dialogs.isSectionEmpty(list);

        if ($chat.length) {
            $chat.removeClass('is-request');
        }

        // update notConfirmed people list
        delete notConfirmed[id];
        ContactList.saveNotConfirmed(notConfirmed);

        const dialogId = Dialog.create({
            _id: hiddenDialogs[id],
            type: 3,
            occupants_ids: [id],
            unread_count: '',
        });

        const dialog = dialogs.get(dialogId);
        Helpers.log('Dialog', dialog.toJSON());

        if (isClick) {
            QB.chat.roster.confirm(jid, () => {
                // send notification about confirm
                sendContactRequest({
                    jid,
                    date_sent: time,
                    dialog_id: hiddenDialogs[id],
                    save_to_history: 1,
                    notification_type: '5',
                });

                Message.create({
                    chat_dialog_id: hiddenDialogs[id],
                    notification_type: '5',
                    date_sent: time,
                    sender_id: User.contact.id,
                    online: true,
                });
            });
        }

        // update roster
        roster[id] = {
            subscription: 'both',
            ask: null,
        };
        ContactList.saveRoster(roster);

        // delete duplicate contact item
        const li = $(`.dialog-item[data-id="${id}"]`);
        list = li.parents('ul');
        li.remove();
        Helpers.Dialogs.isSectionEmpty(list);

        DialogView.addDialogItem(dialog);

        dialogItem = $(`.l-list-wrap section:not(#searchList) .dialog-item[data-id="${id}"]`);
        const copyDialogItem = dialogItem.clone();
        dialogItem.remove();
        $('.j-recentList').prepend(copyDialogItem);
        if ($('#searchList').is(':hidden')) {
            $('#recentList').removeClass('is-hidden');
            Helpers.Dialogs.isSectionEmpty($('.j-recentList'));
        }

        dialogItem = $(`.presence-listener[data-id="${id}"]`);
        dialogItem.find('.status').removeClass('status_request');

        DialogView.decUnreadCounter(dialogId);
    },

    sendReject(jid, isClick) {
        const DialogView = this.app.views.Dialog;
        const id = QB.chat.helpers.getIdFromNode(jid);
        const $objDom = $(`.j-incomingContactRequest[data-jid="${jid}"]`);
        const { roster } = ContactList;
        const notConfirmed = localStorage['QM.notConfirmed'] ? JSON.parse(localStorage['QM.notConfirmed']) : {};
        const hiddenDialogs = JSON.parse(sessionStorage['QM.hiddenDialogs']);
        const time = Math.floor(Date.now() / 1000);

        $objDom.remove();

        Helpers.Dialogs.isSectionEmpty($('.j-requestsList'));

        // update roster
        roster[id] = {
            subscription: 'none',
            ask: null,
        };

        ContactList.saveRoster(roster);

        // update notConfirmed people list
        delete notConfirmed[id];
        ContactList.saveNotConfirmed(notConfirmed);

        if (isClick) {
            QB.chat.roster.reject(jid, () => {
                // send notification about reject
                sendContactRequest({
                    jid,
                    date_sent: time,
                    dialog_id: hiddenDialogs[id],
                    save_to_history: 1,
                    notification_type: '6',
                });
            });
        }

        DialogView.decUnreadCounter(hiddenDialogs[id]);
    },

    sendDelete(id, isClick) {
        const DialogView = self.app.views.Dialog;
        const { VoiceMessage } = self.app.models;
        const { dialogs } = Entities.Collections;
        const jid = QB.chat.helpers.getUserJid(id, QMCONFIG.qbAccount.appId);
        const li = $(`.dialog-item[data-id="${id}"]`);
        const hiddenDialogs = JSON.parse(sessionStorage['QM.hiddenDialogs']);
        const dialogId = li.data('dialog') || hiddenDialogs[id] || null;
        const { roster } = ContactList;
        const dialog = dialogId ? dialogs.get(dialogId) : null;
        const time = Math.floor(Date.now() / 1000);

        // update roster
        delete roster[id];
        ContactList.saveRoster(roster);

        // reset recorder state
        VoiceMessage.resetRecord(dialogId);

        // send notification about reject
        if (isClick) {
            QB.chat.roster.remove(jid, () => {
                sendContactRequest({
                    jid,
                    date_sent: time,
                    dialog_id: dialogId,
                    save_to_history: 1,
                    notification_type: '7',
                });
            });

            if (dialogId) {
                Dialog.deleteChat(dialog);
            }
        }

        if (dialogId) {
            DialogView.removeDialogItem(dialogId);
            DialogView.decUnreadCounter(dialogId);
        }
    },

    // callbacks
    onSubscribe(id) {
        let html;
        const { contacts } = ContactList;
        const jid = QB.chat.helpers.getUserJid(id, QMCONFIG.qbAccount.appId);
        const $requestList = $('.j-requestsList');
        const $recentList = $('.j-recentList');
        const notConfirmed = localStorage['QM.notConfirmed'] ? JSON.parse(localStorage['QM.notConfirmed']) : {};
        let duplicate;

        // update notConfirmed people list
        notConfirmed[id] = true;
        ContactList.saveNotConfirmed(notConfirmed);

        ContactList.add([id], null, () => {
            duplicate = $requestList.find(`.j-incomingContactRequest[data-jid="${jid}"]`).length;

            html = `<li class="list-item j-incomingContactRequest" data-jid="${jid}">`;
            html += '<a class="contact l-flexbox" href="#">';
            html += '<div class="l-flexbox_inline">';
            html += `<div class="contact-avatar avatar profileUserAvatar" style="background-image:url(${typeof contacts[id] !== 'undefined' ? contacts[id].avatar_url : ''})" data-id="${id}"></div>`;
            html += `<span class="name profileUserName" data-id="${id}">${typeof contacts[id] !== 'undefined' ? contacts[id].full_name : ''}</span>`;
            html += '</div><div class="request-controls l-flexbox">';
            html += '<button class="request-button request-button_cancel j-requestCancel">&#10005;</button>';
            html += '<button class="request-button request-button_ok j-requestConfirm">&#10003;</button>';
            html += '</div></a></li>';

            if (!duplicate) {
                $requestList.prepend(html);
            }

            $('#requestsList').removeClass('is-hidden');
            $('#emptyList').addClass('is-hidden');

            if ($recentList.find(`.list-item[data-id="${id}"]`).length) {
                $recentList.find(`.list-item[data-id="${id}"]`).remove();
                self.autoConfirm(id);
                Helpers.Dialogs.isSectionEmpty($recentList);
            }
        }, 'subscribe');
    },

    onConfirm(id) {
        const { roster } = ContactList;
        const dialogItem = $(`.presence-listener[data-id="${id}"]`);
        const $chat = $(`.l-chat[data-id="${id}"]`);

        // update roster
        roster[id] = {
            subscription: 'to',
            ask: null,
        };

        ContactList.saveRoster(roster);

        dialogItem.find('.status').removeClass('status_request');
        dialogItem.removeClass('is-request');

        $chat.removeClass('is-request');
    },

    onReject(id) {
        const { VoiceMessage } = self.app.models;
        const dialogItem = $(`.presence-listener[data-id="${id}"]`);
        const jid = QB.chat.helpers.getUserJid(id, QMCONFIG.qbAccount.appId);
        const request = $(`#requestsList .list-item[data-jid="${jid}"]`);
        const list = request && request.parents('ul');
        const { roster } = ContactList;
        const notConfirmed = localStorage['QM.notConfirmed'] ? JSON.parse(localStorage['QM.notConfirmed']) : {};

        // reset recorder state
        VoiceMessage.resetRecord(dialogItem.data('dialog'));

        // update roster
        roster[id] = {
            subscription: 'none',
            ask: null,
        };
        ContactList.saveRoster(roster);

        // update notConfirmed people list
        delete notConfirmed[id];
        ContactList.saveNotConfirmed(notConfirmed);

        dialogItem.find('.status').removeClass('status_online').addClass('status_request');
        if (dialogItem.is('.l-chat')) {
            dialogItem.addClass('is-request');
        }
        if (request.length > 0) {
            QB.chat.roster.remove(jid, () => {
                request.remove();
                Helpers.Dialogs.isSectionEmpty(list);
            });
        }
        dialogItem.addClass('is-request');
    },

    onPresence(id, type) {
        const dialogItem = $(`.presence-listener[data-id="${id}"]`);
        const { roster } = ContactList;

        // update roster
        if (typeof roster[id] === 'undefined') {
            return;
        }

        roster[id].status = !type;
        ContactList.saveRoster(roster);

        if (type) {
            dialogItem.find('.status').removeClass('status_online');

            if (dialogItem.is('.popup_details')) {
                dialogItem.find('.status_text').text('Offline');
            }
        } else {
            dialogItem.find('.status').addClass('status_online');

            if (dialogItem.is('.popup_details')) {
                dialogItem.find('.status_text').text('Online');
            }
        }
    },

    autoConfirm(id) {
        const jid = QB.chat.helpers.getUserJid(id, QMCONFIG.qbAccount.appId);
        const notConfirmed = localStorage['QM.notConfirmed'] ? JSON.parse(localStorage['QM.notConfirmed']) : {};
        const hiddenDialogs = notConfirmed[id] ? JSON.parse(sessionStorage['QM.hiddenDialogs']) : null;
        const dialogId = hiddenDialogs[id] || null;
        const activeId = Entities.active;
        const { dialogs } = Entities.Collections;
        const dialog = dialogId ? dialogs.get(dialogId) : null;

        self.sendConfirm(jid, 'new_dialog');

        if (activeId === dialogId) {
            Entities.active = '';
            dialog.set({ opened: false });
            $(`.j-dialogItem[data-dialog="${dialogId}"] > .contact`).click();
        }
    },

};

/* Private
---------------------------------------------------------------------- */
function sendContactRequest(params) {
    QB.chat.send(params.jid, {
        type: 'chat',
        body: 'Contact request',
        extension: {
            date_sent: params.date_sent,
            dialog_id: params.dialog_id,
            save_to_history: params.save_to_history,
            notification_type: params.notification_type,
        },
    });
}

function openPopup(objDom, type, dialogId) {
    objDom.add('.popups').addClass('is-overlay');
    if (type) {
        objDom.addClass(type).data('dialog', dialogId);
    } else {
        objDom.removeClass('add').data('dialog', '');
    }
}

function scrollbarContacts() {
    $('.scrollbarContacts').mCustomScrollbar({
        theme: 'minimal-dark',
        scrollInertia: 150,
        mouseWheel: {
            scrollAmount: 60,
            deltaFactor: 'auto',
        },
        live: true,
    });
}

function scrollbar(list, selfObj) {
    list.mCustomScrollbar({
        theme: 'minimal-dark',
        scrollInertia: 150,
        mouseWheel: {
            scrollAmount: 60,
            deltaFactor: 'auto',
        },
        callbacks: {
            onTotalScroll() {
                ajaxDownloading(list, selfObj);
            },
        },
        live: true,
    });
}

// ajax downloading of data through scroll
function ajaxDownloading(list, selfObj) {
    const page = parseInt(sessionStorage['QM.search.page'], 10);
    const allPages = parseInt(sessionStorage['QM.search.allPages'], 10);

    if (page <= allPages) {
        selfObj.createDataSpinner(list);
        ContactList.globalSearch((results) => {
            createListResults(list, results, selfObj);
        });
    }
}

function createListResults(list, results, selfObj) {
    const { roster } = ContactList;
    const notConfirmed = localStorage['QM.notConfirmed'] ? JSON.parse(localStorage['QM.notConfirmed']) : {};
    let item;

    if (results.length > 0) {
        results.forEach((contact) => {
            const rosterItem = roster[contact.id];

            item = `<li class="list-item j-listItem" data-jid="${contact.user_jid}">`;
            item += '<a class="contact l-flexbox" href="#">';
            item += '<div class="l-flexbox_inline">';
            item += `<div class="contact-avatar avatar profileUserAvatar" style="background-image:url(${contact.avatar_url})" data-id="${contact.id}"></div>`;
            item += `<span class="name profileUserName" data-id="${contact.id}">${contact.full_name}</span>`;
            item += '</div>';
            if (!rosterItem || (rosterItem && rosterItem.subscription === 'none' && !rosterItem.ask && !notConfirmed[contact.id])) {
                item += '<button class="send-request j-sendRequest"><img class="icon-normal" src="images/icon-request.svg" alt="request">';
                item += '<img class="icon-active" src="images/icon-request_active.svg" alt="request"></button>';
            }
            if (rosterItem && rosterItem.subscription === 'none' && rosterItem.ask) {
                item += '<span class="send-request l-flexbox">Request Sent</span>';
            }
            item += '</a></li>';

            list.find('.mCSB_container').append(item);
            list.removeClass('is-hidden').siblings('.popup-elem').addClass('is-hidden');
        });
    } else {
        list.parents('.popup_search').find('.note').removeClass('is-hidden').siblings('.popup-elem')
            .addClass('is-hidden');
    }

    selfObj.removeDataSpinner();
}

module.exports = ContactListView;
