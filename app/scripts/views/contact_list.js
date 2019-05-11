/*
 * Q-municate chat application
 *
 * Contact List View Module
 *
 */
define([
    'jquery',
    'config',
    'Entities',
    'Helpers',
    'QMHtml',
    'underscore',
    'mCustomScrollbar',
    'mousewheel'
], function(
    $,
    QMCONFIG,
    Entities,
    Helpers,
    QMHtml,
    _
) {
    var self;

    var Dialog;
    var Message;
    var ContactList;
    var User;

    function ContactListView(app) {
        this.app = app;
        Dialog = this.app.models.Dialog;
        Message = this.app.models.Message;
        ContactList = this.app.models.ContactList;
        User = this.app.models.User;
        self = this;

        scrollbarContacts();
    }

    ContactListView.prototype = {

        createDataSpinner: function(list) {
            var spinnerBlock = '';

            this.removeDataSpinner();

            spinnerBlock += '<div class="popup-elem spinner_bounce">';
            spinnerBlock += '<div class="spinner_bounce-bounce1"></div>';
            spinnerBlock += '<div class="spinner_bounce-bounce2"></div>';
            spinnerBlock += '<div class="spinner_bounce-bounce3"></div>';
            spinnerBlock += '</div>';

            list.after(spinnerBlock);
        },

        removeDataSpinner: function() {
            $('.popup:visible .spinner_bounce').remove();
            $('.popup:visible input').prop('disabled', false);
        },

        globalPopup: function() {
            var popup = $('#popupSearch');

            openPopup(popup);
            popup.find('.popup-elem')
                .addClass('is-hidden')
                .siblings('form')
                .find('input')
                .val('');
            popup.find('.mCSB_container').empty();
        },

        globalSearch: function($form) {
            var that = this;
            var $popup = $form.parent();
            var $list = $popup.find('ul:first.list_contacts');
            var $firstNote = $popup.find('.j-start_search_note');
            var val = $form.find('input[type="search"]').val().trim();
            var len = val.length;

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

                ContactList.globalSearch(function(results) {
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

        addContactsToChat: function(objDom, type, dialogId, isPrivate) {
            var ids = objDom.data('ids') ? objDom.data('ids').toString().split(',') : [];
            var popup = $('#popupContacts');
            var contacts = ContactList.contacts;
            var roster = ContactList.roster;
            var sortedContacts;
            var existingIds;
            var userId;
            var friends;
            var html;

            openPopup(popup, type, dialogId);
            popup.addClass('not-selected').removeClass('is-addition');
            popup.find('.note').addClass('is-hidden').siblings('ul').removeClass('is-hidden');
            popup.find('.popup-nofriends').addClass('is-hidden').siblings().removeClass('is-hidden');
            popup.find('form')[0].reset();
            popup.find('.list_contacts').mCustomScrollbar('scrollTo', 'top');
            popup.find('.mCSB_container').empty();
            popup.find('.btn').removeClass('is-hidden');

            // get your friends which are sorted by alphabet
            sortedContacts = _.pluck(_.sortBy(contacts, function(user) {
                if (user.full_name) {
                    return user.full_name.toLowerCase();
                }
                return user.full_name;
            }), 'id').map(String);
            friends = _.filter(sortedContacts, function(el) {
                return roster[el] && roster[el].subscription !== 'none';
            });
            Helpers.log('Friends', friends);

            if (friends.length === 0) {
                popup.children(':not(.popup-header)').addClass('is-hidden');
                popup.find('.popup-nofriends').removeClass('is-hidden');
                return;
            }

            // exclude users who are already present in the dialog
            friends = _.difference(friends, ids);

            friends.forEach(function(item) {
                userId = item;

                html = '';
                html += '<li class="list-item" data-id="' + userId + '">';
                html += '<a class="contact l-flexbox" href="#">';
                html += '<div class="l-flexbox_inline">';
                html += '<div class="contact-avatar avatar profileUserAvatar" style="background-image:url(' + contacts[userId].avatar_url + ')" data-id="' + userId + '"></div>';
                html += '<span class="name profileUserName" data-id="' + userId + '">' + contacts[userId].full_name + '</span>';
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

        importFBFriend: function(id) {
            var jid = QB.chat.helpers.getUserJid(id, QMCONFIG.qbAccount.appId);
            var roster = ContactList.roster;

            QB.chat.roster.add(jid, function() {
                // update roster
                roster[id] = {
                    subscription: 'none',
                    ask: 'subscribe'
                };
                ContactList.saveRoster(roster);

                Dialog.createPrivate(jid);
            });
        },

        sendSubscribe: function(jid, isChat, dialogId) {
            var MessageView = this.app.views.Message;
            var $objDom = $('.list-item[data-jid="' + jid + '"]');
            var roster = ContactList.roster;
            var id = QB.chat.helpers.getIdFromNode(jid);
            var $dialogItem = $('.dialog-item[data-id="' + id + '"]');
            var dialogItem = $dialogItem[0];
            var requestItem = $('#requestsList .list-item[data-jid="' + jid + '"]');
            var notConfirmed = localStorage['QM.notConfirmed'] ? JSON.parse(localStorage['QM.notConfirmed']) : {};
            var time = Math.floor(Date.now() / 1000);
            var copyDialogItem;
            var message;
            var that = this;

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
                    QB.chat.roster.add(jid, function() {
                        if ($dialogItem.length) {
                            // send notification about subscribe
                            sendContactRequest({
                                jid: jid,
                                date_sent: time,
                                dialog_id: dialogItem.getAttribute('data-dialog'),
                                save_to_history: 1,
                                notification_type: '4'
                            });

                            message = Message.create({
                                date_sent: time,
                                chat_dialog_id: dialogItem.getAttribute('data-dialog'),
                                sender_id: User.contact.id,
                                notification_type: '4',
                                online: true
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
                ask: 'subscribe'
            };
            ContactList.saveRoster(roster);

            dialogItem = $('.l-list-wrap section:not(#searchList) .dialog-item[data-id="' + id + '"]');
            copyDialogItem = dialogItem.clone();
            dialogItem.remove();
            $('#recentList ul').prepend(copyDialogItem);
            if ($('#searchList').is(':hidden')) {
                $('#recentList').removeClass('is-hidden');
                Helpers.Dialogs.isSectionEmpty($('.j-recentList'));
            }

            function changeRequestStatus(text) {
                var $buttonRequest = $objDom.find('.j-sendRequest');

                $buttonRequest.after('<span class="send-request l-flexbox">' + text + '</span>');
                $buttonRequest.remove();
            }
        },

        sendConfirm: function(jid, isClick) {
            var DialogView = this.app.views.Dialog;
            var $objDom = $('.j-incomingContactRequest[data-jid="' + jid + '"]');
            var id = QB.chat.helpers.getIdFromNode(jid);
            var $chat = $('.l-chat[data-id="' + id + '"]');
            var list = $objDom.parents('ul.j-requestsList');
            var roster = ContactList.roster;
            var notConfirmed = localStorage['QM.notConfirmed'] ? JSON.parse(localStorage['QM.notConfirmed']) : {};
            var hiddenDialogs = JSON.parse(sessionStorage['QM.hiddenDialogs']);
            var time = Math.floor(Date.now() / 1000);
            var dialogs = Entities.Collections.dialogs;
            var copyDialogItem;
            var dialogItem;
            var dialogId;
            var dialog;
            var li;

            $objDom.remove();

            Helpers.Dialogs.isSectionEmpty(list);

            if ($chat.length) {
                $chat.removeClass('is-request');
            }

            // update notConfirmed people list
            delete notConfirmed[id];
            ContactList.saveNotConfirmed(notConfirmed);

            dialogId = Dialog.create({
                _id: hiddenDialogs[id],
                type: 3,
                occupants_ids: [id],
                unread_count: ''
            });

            dialog = dialogs.get(dialogId);
            Helpers.log('Dialog', dialog.toJSON());

            if (isClick) {
                QB.chat.roster.confirm(jid, function() {
                    // send notification about confirm
                    sendContactRequest({
                        jid: jid,
                        date_sent: time,
                        dialog_id: hiddenDialogs[id],
                        save_to_history: 1,
                        notification_type: '5'
                    });

                    Message.create({
                        chat_dialog_id: hiddenDialogs[id],
                        notification_type: '5',
                        date_sent: time,
                        sender_id: User.contact.id,
                        online: true
                    });
                });
            }

            // update roster
            roster[id] = {
                subscription: 'both',
                ask: null
            };
            ContactList.saveRoster(roster);

            // delete duplicate contact item
            li = $('.dialog-item[data-id="' + id + '"]');
            list = li.parents('ul');
            li.remove();
            Helpers.Dialogs.isSectionEmpty(list);

            DialogView.addDialogItem(dialog);

            dialogItem = $('.l-list-wrap section:not(#searchList) .dialog-item[data-id="' + id + '"]');
            copyDialogItem = dialogItem.clone();
            dialogItem.remove();
            $('.j-recentList').prepend(copyDialogItem);
            if ($('#searchList').is(':hidden')) {
                $('#recentList').removeClass('is-hidden');
                Helpers.Dialogs.isSectionEmpty($('.j-recentList'));
            }

            dialogItem = $('.presence-listener[data-id="' + id + '"]');
            dialogItem.find('.status').removeClass('status_request');

            DialogView.decUnreadCounter(dialogId);
        },

        sendReject: function(jid, isClick) {
            var DialogView = this.app.views.Dialog;
            var id = QB.chat.helpers.getIdFromNode(jid);
            var $objDom = $('.j-incomingContactRequest[data-jid="' + jid + '"]');
            var roster = ContactList.roster;
            var notConfirmed = localStorage['QM.notConfirmed'] ? JSON.parse(localStorage['QM.notConfirmed']) : {};
            var hiddenDialogs = JSON.parse(sessionStorage['QM.hiddenDialogs']);
            var time = Math.floor(Date.now() / 1000);

            $objDom.remove();

            Helpers.Dialogs.isSectionEmpty($('.j-requestsList'));

            // update roster
            roster[id] = {
                subscription: 'none',
                ask: null
            };

            ContactList.saveRoster(roster);

            // update notConfirmed people list
            delete notConfirmed[id];
            ContactList.saveNotConfirmed(notConfirmed);

            if (isClick) {
                QB.chat.roster.reject(jid, function() {
                    // send notification about reject
                    sendContactRequest({
                        jid: jid,
                        date_sent: time,
                        dialog_id: hiddenDialogs[id],
                        save_to_history: 1,
                        notification_type: '6'
                    });
                });
            }

            DialogView.decUnreadCounter(hiddenDialogs[id]);
        },

        sendDelete: function(id, isClick) {
            var DialogView = self.app.views.Dialog;
            var VoiceMessage = self.app.models.VoiceMessage;
            var dialogs = Entities.Collections.dialogs;
            var jid = QB.chat.helpers.getUserJid(id, QMCONFIG.qbAccount.appId);
            var li = $('.dialog-item[data-id="' + id + '"]');
            var hiddenDialogs = JSON.parse(sessionStorage['QM.hiddenDialogs']);
            var dialogId = li.data('dialog') || hiddenDialogs[id] || null;
            var roster = ContactList.roster;
            var dialog = dialogId ? dialogs.get(dialogId) : null;
            var time = Math.floor(Date.now() / 1000);

            // update roster
            delete roster[id];
            ContactList.saveRoster(roster);

            // reset recorder state
            VoiceMessage.resetRecord(dialogId);

            // send notification about reject
            if (isClick) {
                QB.chat.roster.remove(jid, function() {
                    sendContactRequest({
                        jid: jid,
                        date_sent: time,
                        dialog_id: dialogId,
                        save_to_history: 1,
                        notification_type: '7'
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
        onSubscribe: function(id) {
            var html;
            var contacts = ContactList.contacts;
            var jid = QB.chat.helpers.getUserJid(id, QMCONFIG.qbAccount.appId);
            var $requestList = $('.j-requestsList');
            var $recentList = $('.j-recentList');
            var notConfirmed = localStorage['QM.notConfirmed'] ? JSON.parse(localStorage['QM.notConfirmed']) : {};
            var duplicate;

            // update notConfirmed people list
            notConfirmed[id] = true;
            ContactList.saveNotConfirmed(notConfirmed);

            ContactList.add([id], null, function() {
                duplicate = $requestList.find('.j-incomingContactRequest[data-jid="' + jid + '"]').length;

                html = '<li class="list-item j-incomingContactRequest" data-jid="' + jid + '">';
                html += '<a class="contact l-flexbox" href="#">';
                html += '<div class="l-flexbox_inline">';
                html += '<div class="contact-avatar avatar profileUserAvatar" style="background-image:url(' + (typeof contacts[id] !== 'undefined' ? contacts[id].avatar_url : '') + ')" data-id="' + id + '"></div>';
                html += '<span class="name profileUserName" data-id="' + id + '">' + (typeof contacts[id] !== 'undefined' ? contacts[id].full_name : '') + '</span>';
                html += '</div><div class="request-controls l-flexbox">';
                html += '<button class="request-button request-button_cancel j-requestCancel">&#10005;</button>';
                html += '<button class="request-button request-button_ok j-requestConfirm">&#10003;</button>';
                html += '</div></a></li>';

                if (!duplicate) {
                    $requestList.prepend(html);
                }

                $('#requestsList').removeClass('is-hidden');
                $('#emptyList').addClass('is-hidden');

                if ($recentList.find('.list-item[data-id="' + id + '"]').length) {
                    $recentList.find('.list-item[data-id="' + id + '"]').remove();
                    self.autoConfirm(id);
                    Helpers.Dialogs.isSectionEmpty($recentList);
                }
            }, 'subscribe');
        },

        onConfirm: function(id) {
            var roster = ContactList.roster;
            var dialogItem = $('.presence-listener[data-id="' + id + '"]');
            var $chat = $('.l-chat[data-id="' + id + '"]');

            // update roster
            roster[id] = {
                subscription: 'to',
                ask: null
            };

            ContactList.saveRoster(roster);

            dialogItem.find('.status').removeClass('status_request');
            dialogItem.removeClass('is-request');

            $chat.removeClass('is-request');
        },

        onReject: function(id) {
            var VoiceMessage = self.app.models.VoiceMessage;
            var dialogItem = $('.presence-listener[data-id="' + id + '"]');
            var jid = QB.chat.helpers.getUserJid(id, QMCONFIG.qbAccount.appId);
            var request = $('#requestsList .list-item[data-jid="' + jid + '"]');
            var list = request && request.parents('ul');
            var roster = ContactList.roster;
            var notConfirmed = localStorage['QM.notConfirmed'] ? JSON.parse(localStorage['QM.notConfirmed']) : {};

            // reset recorder state
            VoiceMessage.resetRecord(dialogItem.data('dialog'));

            // update roster
            roster[id] = {
                subscription: 'none',
                ask: null
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
                QB.chat.roster.remove(jid, function() {
                    request.remove();
                    Helpers.Dialogs.isSectionEmpty(list);
                });
            }
            dialogItem.addClass('is-request');
        },

        onPresence: function(id, type) {
            var dialogItem = $('.presence-listener[data-id="' + id + '"]');
            var roster = ContactList.roster;

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

        autoConfirm: function(id) {
            var jid = QB.chat.helpers.getUserJid(id, QMCONFIG.qbAccount.appId);
            var notConfirmed = localStorage['QM.notConfirmed'] ? JSON.parse(localStorage['QM.notConfirmed']) : {};
            var hiddenDialogs = notConfirmed[id] ? JSON.parse(sessionStorage['QM.hiddenDialogs']) : null;
            var dialogId = hiddenDialogs[id] || null;
            var activeId = Entities.active;
            var dialogs = Entities.Collections.dialogs;
            var dialog = dialogId ? dialogs.get(dialogId) : null;

            self.sendConfirm(jid, 'new_dialog');

            if (activeId === dialogId) {
                Entities.active = '';
                dialog.set({ opened: false });
                $('.j-dialogItem[data-dialog="' + dialogId + '"] > .contact').click();
            }
        }

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
                notification_type: params.notification_type
            }
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
                deltaFactor: 'auto'
            },
            live: true
        });
    }

    function scrollbar(list, selfObj) {
        list.mCustomScrollbar({
            theme: 'minimal-dark',
            scrollInertia: 150,
            mouseWheel: {
                scrollAmount: 60,
                deltaFactor: 'auto'
            },
            callbacks: {
                onTotalScroll: function() {
                    ajaxDownloading(list, selfObj);
                }
            },
            live: true
        });
    }

    // ajax downloading of data through scroll
    function ajaxDownloading(list, selfObj) {
        var page = parseInt(sessionStorage['QM.search.page'], 10);
        var allPages = parseInt(sessionStorage['QM.search.allPages'], 10);

        if (page <= allPages) {
            selfObj.createDataSpinner(list);
            ContactList.globalSearch(function(results) {
                createListResults(list, results, selfObj);
            });
        }
    }

    function createListResults(list, results, selfObj) {
        var roster = ContactList.roster;
        var notConfirmed = localStorage['QM.notConfirmed'] ? JSON.parse(localStorage['QM.notConfirmed']) : {};
        var item;

        if (results.length > 0) {
            results.forEach(function(contact) {
                var rosterItem = roster[contact.id];

                item = '<li class="list-item j-listItem" data-jid="' + contact.user_jid + '">';
                item += '<a class="contact l-flexbox" href="#">';
                item += '<div class="l-flexbox_inline">';
                item += '<div class="contact-avatar avatar profileUserAvatar" style="background-image:url(' + contact.avatar_url + ')" data-id="' + contact.id + '"></div>';
                item += '<span class="name profileUserName" data-id="' + contact.id + '">' + contact.full_name + '</span>';
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

    return ContactListView;
});
