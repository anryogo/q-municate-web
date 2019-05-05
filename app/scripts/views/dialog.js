/*
 * Q-municate chat application
 *
 * Dialog View Module
 *
 */
define([
    'jquery',
    'underscore',
    'config',
    'Entities',
    'Helpers',
    'QMHtml',
    'minEmoji',
    'perfectscrollbar',
    'mCustomScrollbar',
    'nicescroll'
], function (
    $,
    _,
    QMCONFIG,
    Entities,
    Helpers,
    QMHtml,
    minEmoji,
    Ps
) {
    var self;

    var User;
    var Dialog;
    var Message;
    var ContactList;
    var VoiceMessage;
    var Listeners;
    var errorDialogsLoadingID;
    var errorMessagesLoadingID;
    var UPDATE_PERIOD = 10000;

    var unreadDialogs = {};

    var TITLE_NAME = 'Q-municate';
    var FAVICON_COUNTER = 'images/favicon_counter.png';
    var FAVICON = 'images/favicon.png';

    function DialogView(app) {
        self = this;

        this.app = app;
        User = this.app.models.User;
        Dialog = this.app.models.Dialog;
        Message = this.app.models.Message;
        ContactList = this.app.models.ContactList;
        VoiceMessage = this.app.models.VoiceMessage;
        Listeners = this.app.listeners;
    }

    DialogView.prototype = {

        createDataSpinner: function (chat, groupchat, isAjaxDownloading) {
            var spinnerBlock;

            this.removeDataSpinner();

            if (isAjaxDownloading) {
                spinnerBlock = '<div class="message message_service msg_preloader">'
                    + '<div class="popup-elem j-loading spinner_bounce is-empty is-ajaxDownload">';
            } else if (groupchat) {
                spinnerBlock = '<div class="popup-elem j-loading spinner_bounce is-creating">';
            } else {
                spinnerBlock = '<div class="popup-elem j-loading spinner_bounce is-empty">';
            }

            spinnerBlock += '<div class="spinner_bounce-bounce1"></div>';
            spinnerBlock += '<div class="spinner_bounce-bounce2"></div>';
            spinnerBlock += '<div class="spinner_bounce-bounce3"></div>';
            spinnerBlock += '</div>';

            if (isAjaxDownloading) {
                spinnerBlock += '</div>';
            }

            if (chat) {
                $('.l-chat:visible').find('.l-chat-content').append(spinnerBlock);
            } else if (groupchat) {
                $('#popupContacts .btn_popup').addClass('is-hidden');
                $('#popupContacts .popup-footer').append(spinnerBlock);
                $('#popupContacts .popup-footer').after('<div class="temp-box"></div>');
            } else if (isAjaxDownloading) {
                $('.l-chat:visible').find('.l-chat-content').prepend(spinnerBlock);
            } else {
                $('#emptyList').after(spinnerBlock);
            }
        },

        removeDataSpinner: function () {
            $('.spinner_bounce, .temp-box, div.message_service').remove();
        },

        prepareDownloading: function () {
            scrollbarAside();
            Listeners.setQBHandlers();
            User.initProfile();
            self.createDataSpinner();
            self.app.views.Settings.setUp(User.contact.id);
            self.app.models.SyncTabs.init(User.contact.id);
        },

        getUnreadCounter: function (dialogId) {
            var counter;

            if (typeof unreadDialogs[dialogId] === 'undefined') {
                unreadDialogs[dialogId] = true;
                counter = Object.keys(unreadDialogs).length;

                $('title').text('(' + counter + ') ' + TITLE_NAME);
                $('link[rel="icon"]').remove();
                $('head').append('<link rel="icon" href="' + FAVICON_COUNTER + '">');
            }
        },

        decUnreadCounter: function (dialogId) {
            var counter;

            if (typeof unreadDialogs[dialogId] !== 'undefined') {
                delete unreadDialogs[dialogId];
                counter = Object.keys(unreadDialogs).length;

                if (counter > 0) {
                    $('title').text('(' + counter + ') ' + TITLE_NAME);
                } else {
                    $('title').text(TITLE_NAME);
                    $('link[rel="icon"]').remove();
                    $('head').append('<link rel="icon" href="' + FAVICON + '">');
                }
            }
        },

        logoutWithClearData: function () {
            scrollbarAside(true);
            unreadDialogs = {};
            $('title').text(TITLE_NAME);
            $('link[rel="icon"]').remove();
            $('head').append('<link rel="icon" href="' + FAVICON + '">');
            $('.mediacall-remote-duration').text('connecting...');
            $('.mediacall-info-duration').text('');
        },

        downloadDialogs: function (ids, skip) {
            var ContactListView = this.app.views.ContactList;
            var hiddenDialogs = sessionStorage['QM.hiddenDialogs'] ? JSON.parse(sessionStorage['QM.hiddenDialogs']) : {};
            var parameter = !skip ? null : 'old_dialog';
            var dialogsCollection = Entities.Collections.dialogs;
            var activeId = Entities.active;
            var roster = ContactList.roster;
            var rosterIds = Object.keys(roster);
            var totalEntries;
            var localEntries;
            var occupantsIds;
            var notConfirmed;
            var privateId;
            var dialogId;
            var dialogs;
            var dialog;
            var chat;

            self.removeDataSpinner();
            self.createDataSpinner();

            Dialog.download({
                sort_desc: 'last_message_date_sent',
                skip: skip || 0
            }, function (error, result) {
                if (error) {
                    self.removeDataSpinner();

                    errorDialogsLoadingID = setTimeout(function () {
                        self.downloadDialogs(ids, skip);
                    }, UPDATE_PERIOD);

                    return;
                }
                clearTimeout(errorDialogsLoadingID);


                dialogs = result.items;
                totalEntries = result.total_entries;
                localEntries = result.limit + result.skip;

                if (dialogs.length > 0) {
                    occupantsIds = _.uniq(_.flatten(_.pluck(dialogs, 'occupants_ids'), true));
                    // updating of Contact List whereto are included all people
                    // with which maybe user will be to chat (there aren't only his friends)
                    ContactList.add(occupantsIds, null, function () {
                        var len;
                        var i;

                        for (i = 0, len = dialogs.length; i < len; i++) {
                            dialogId = Dialog.create(dialogs[i]);
                            dialog = dialogsCollection.get(dialogId);

                            // don't create a duplicate dialog in contact list
                            chat = $('.l-list-wrap section:not(#searchList) .dialog-item[data-dialog="' + dialog.get('id') + '"]');
                            if (chat[0] && dialog.get('unread_count')) {
                                chat.find('.unread').text(dialog.get('unread_count'));
                                self.getUnreadCounter(dialog.get('id'));
                                continue; // eslint-disable-line no-continue
                            }

                            if ((dialog.get('type') === 2) && !dialog.get('joined')) {
                                QB.chat.muc.join(dialog.get('room_jid'));
                                dialog.set('joined', true);
                            }

                            // update hidden dialogs
                            privateId = dialog.get('type') === 3 ? dialog.get('occupants_ids')[0] : null;
                            hiddenDialogs[privateId] = dialog.get('id');
                            ContactList.saveHiddenDialogs(hiddenDialogs);

                            // not show dialog if user has not confirmed this contact
                            notConfirmed = localStorage['QM.notConfirmed'] ? JSON.parse(localStorage['QM.notConfirmed']) : {};
                            if (privateId && (!roster[privateId]
                                || (roster[privateId] && roster[privateId].subscription === 'none'
                                && !roster[privateId].ask && notConfirmed[privateId]))) {
                                continue; // eslint-disable-line no-continue
                            }

                            self.addDialogItem(dialog, true, parameter);
                        }

                        if ($('#requestsList').is('.is-hidden')
                            && $('#recentList').is('.is-hidden')
                            && $('#historyList').is('.is-hidden')) {
                            $('#emptyList').removeClass('is-hidden');
                        }
                    });
                } else if (!skip) {
                    $('#emptyList').removeClass('is-hidden');
                }

                // import FB friends
                if (ids) {
                    ContactList.getFBFriends(ids, function (newIds) {
                        var len;
                        var i;

                        openPopup($('#popupImport'));
                        for (i = 0, len = newIds.length; i < len; i++) {
                            ContactListView.importFBFriend(newIds[i]);
                        }
                    });
                }

                self.getAllUsers(rosterIds);
                self.removeDataSpinner();

                if (totalEntries >= localEntries) {
                    self.downloadDialogs(ids, localEntries);
                } else if (activeId) {
                    dialogsCollection.get(activeId)
                        .set({ opened: false });
                    dialogsCollection.selectDialog(activeId);
                }
            });
        },

        showOldHistory: function (callback) {
            var hiddenDialogs = $('#oldHistoryList ul').children('.j-dialogItem');
            var visibleDialogs = $('#historyList ul');
            var total = hiddenDialogs.length;
            var limit = total > 100 ? 100 : total;
            var offListener = false;

            if (total === limit) {
                offListener = true;
            }

            visibleDialogs.append(hiddenDialogs.slice(0, limit));
            callback(offListener);
        },

        getAllUsers: function (rosterIds) {
            var QBApiCalls = this.app.service;
            var Contact = this.app.models.Contact;
            var params = {
                filter: {
                    field: 'id',
                    param: 'in',
                    value: rosterIds
                },
                per_page: 100
            };

            QBApiCalls.listUsers(params, function (users) {
                users.items.forEach(function (qbUser) {
                    var user = qbUser.user;
                    var contact = Contact.create(user);

                    ContactList.contacts[contact.id] = contact;

                    $('.profileUserName[data-id="' + contact.id + '"]').text(contact.full_name);
                    $('.profileUserStatus[data-id="' + contact.id + '"]').text(contact.status);
                    $('.profileUserPhone[data-id="' + contact.id + '"]').html(
                        '<span class="userDetails-label">Phone:</span><span class="userDetails-phone">' + contact.phone + '</span>'
                    );
                    $('.profileUserAvatar[data-id="' + contact.id + '"]').css('background-image', 'url(' + contact.avatar_url + ')');

                    localStorage.setItem('QM.contact-' + contact.id, JSON.stringify(contact));
                });
            });
        },

        hideDialogs: function () {
            $('.j-aside_list_item').addClass('is-hidden');
            $('.j-list').each(function (index, element) {
                $(element).html('');
            });
        },

        addDialogItem: function (dialog, isDownload, parameter) {
            if (!dialog) {
                Helpers.log('Dialog is undefined');
                return;
            }

            /* eslint-disable vars-on-top */
            var privateId;
            var contacts = ContactList.contacts;
            var roster = ContactList.roster;
            var lastMessageDateSent = dialog.get('last_message_date_sent');
            var occupantsIds = dialog.get('occupants_ids');
            var unreadCount = dialog.get('unread_count');
            var roomPhoto = dialog.get('room_photo');
            var roomName = dialog.get('room_name');
            var dialogType = dialog.get('type');
            var dialogId = dialog.get('id');
            var lastTime = Helpers.getTime(lastMessageDateSent, true);
            var lastMessage = minEmoji(Helpers.Messages.parser(dialog.get('last_message')));
            var defaultAvatar = privateId ? QMCONFIG.defAvatar.url : QMCONFIG.defAvatar.group_url;
            var startOfCurrentDay;
            var status;
            var icon;
            var name;
            var html;
            var $dialogItem;
            /* eslint-enable vars-on-top */

            privateId = dialogType === 3 ? occupantsIds[0] : null;

            try {
                /* eslint-disable max-len */
                icon = (privateId && contacts[privateId]) ? contacts[privateId].avatar_url : (roomPhoto || defaultAvatar);
                name = (privateId && contacts[privateId]) ? contacts[privateId].full_name : roomName;
                /* eslint-enable max-len */
                status = roster[privateId] ? roster[privateId] : null;
            } catch (error) {
                throw error;
            }

            html = '<li class="list-item dialog-item j-dialogItem presence-listener" data-dialog="' + dialogId + '" data-id="' + privateId + '">';
            html += '<div class="contact l-flexbox" href="#">';
            html += '<div class="l-flexbox_inline">';
            html += '<div class="contact-avatar avatar profileUserAvatar j-avatar" style="background-image: url(' + icon + ')" data-id="' + privateId + '"></div>';
            html += '<div class="dialog_body"><span class="name name_dialog profileUserName" data-id="' + privateId + '">' + name + '</span>';
            html += '<span class="last_message_preview j-lastMessagePreview">' + lastMessage + '</span></div></div>';

            if (dialogType === 3) {
                html += getStatus(status);
            } else {
                html += '<span class="status"></span>';
            }

            html += '<span class="last_time_preview j-lastTimePreview">' + lastTime + '</span>';
            html += '<span class="unread">' + unreadCount + '</span>';
            html += '</a></li>';

            startOfCurrentDay = new Date();
            startOfCurrentDay.setHours(0, 0, 0, 0);

            // remove duplicate and replace to newest
            $dialogItem = $('.j-dialogItem[data-dialog="' + dialogId + '"]');

            if ($dialogItem.length) {
                $dialogItem.remove();
            }

            // checking if this dialog is recent OR no
            if (!lastMessageDateSent
                || (new Date(lastMessageDateSent * 1000) > startOfCurrentDay)
                || parameter === 'new_dialog') {
                if (isDownload) {
                    $('#recentList').removeClass('is-hidden').find('ul').append(html);
                } else if (!$('#searchList').is(':visible')) {
                    $('#recentList').removeClass('is-hidden').find('ul').prepend(html);
                } else {
                    $('#recentList').removeClass('is-hidden').find('ul').prepend(html);
                }
            } else if (parameter === 'old_dialog') {
                $('#oldHistoryList').find('ul').append(html);
            } else if (!$('#searchList').is(':visible')) {
                $('#historyList').removeClass('is-hidden').find('ul').append(html);
            }

            $('#emptyList').addClass('is-hidden');
            if (unreadCount) {
                self.getUnreadCounter(dialogId);
            }

            if (icon !== defaultAvatar) {
                self.validateAvatar({
                    privateId: privateId,
                    dialogId: dialogId,
                    iconURL: icon
                });
            }
        },


        htmlBuild: function (elemOrId, messages) {
            Entities.Collections.dialogs.saveDraft();

            /* eslint-disable vars-on-top */
            var QBApiCalls = this.app.service;
            var contacts = ContactList.contacts;
            var dialogs = Entities.Collections.dialogs;
            var roster = ContactList.roster;
            var $dialog = (typeof elemOrId === 'object') ? elemOrId
                : $('.j-dialogItem[data-dialog="' + elemOrId + '"]');
            var dialogId = $dialog.data('dialog');
            var userId = $dialog.data('id');
            var dialog = dialogs.get(dialogId);
            var user = contacts[userId];
            var readBadge = 'QM.' + User.contact.id + '_readBadge';
            var unreadCount = Number($dialog.find('.unread').text());
            var occupantsIds = dialog.get('occupants_ids');
            var $chatWrap = $('.j-chatWrap');
            var $chatView = $('.chatView');
            var $selected = $('.is-selected');
            var isBlocked;
            var isCall;
            var location;
            var status;
            var html;
            var icon;
            var name;
            var jid;
            /* eslint-enable vars-on-top */

            // remove the private dialog with deleted user
            if (userId && !user) {
                QBApiCalls.getUser(userId, function (res) {
                    if (!res.items.length) {
                        self.deleteChat(dialogId);
                    }
                });

                return;
            }

            Entities.active = dialogId;
            isBlocked = $('.icon_videocall, .icon_audiocall').length;
            isCall = $dialog.find('.icon_videocall').length || $dialog.find('.icon_audiocall').length;
            jid = dialog.get('room_jid') || user.user_jid;
            icon = userId ? user.avatar_url : (dialog.get('room_photo') || QMCONFIG.defAvatar.group_url);
            name = dialog.get('room_name') || user.full_name;
            status = roster[userId] ? roster[userId] : null;
            location = (localStorage['QM.latitude'] && localStorage['QM.longitude']) ? 'btn_active' : '';
            Message.skip = 0;

            $('.l-workspace-wrap .l-workspace').addClass('is-hidden');

            $chatView.each(function (index, element) {
                var $element = $(element);

                if ($element.hasClass('j-mediacall')) {
                    $element.addClass('is-hidden');
                } else {
                    $element.remove();
                }
            });

            if (isCall) {
                $chatWrap.removeClass('is-hidden');
                $chatView.removeClass('is-hidden');
            } else {
                buildChat();
            }

            textAreaScrollbar('#textarea_' + dialogId);
            messageScrollbar('#mCS_' + dialogId);

            self.showChatWithNewMessages(dialogId, unreadCount, messages);

            removeNewMessagesLabel($selected.data('dialog'), dialogId);

            $selected.removeClass('is-selected');
            $dialog.addClass('is-selected')
                .find('.unread').text('');
            self.decUnreadCounter(dialog.get('id'));

            // set dialogId to localStorage wich must bee read in all tabs for same user
            localStorage.removeItem(readBadge);
            localStorage.setItem(readBadge, dialogId);


            // reset recorder state
            VoiceMessage.resetRecord();

            if (isBlocked) {
                VoiceMessage.blockRecorder('during a call');
            }

            function buildChat() {
                var id;
                var len;
                var i;

                new Entities.Models.Chat({ // eslint-disable-line no-new
                    occupantsIds: occupantsIds,
                    status: getStatus(status),
                    dialog_id: dialogId,
                    draft: dialog.get('draft'),
                    location: location,
                    type: dialog.get('type'),
                    user_id: userId,
                    name: name,
                    icon: icon,
                    jid: jid
                });

                // build occupants of room
                if (dialog.get('type') === 2) {
                    html = '<div class="chat-occupants">';
                    for (i = 0, len = occupantsIds.length; i < len; i++) {
                        id = occupantsIds[i];

                        if (!contacts[id]) continue; // eslint-disable-line no-continue

                        if (id !== User.contact.id) {
                            html += '<a class="occupant l-flexbox_inline presence-listener" data-id="' + id + '" href="#">';
                            html += getStatus(roster[id]);
                            html += '<span class="name name_occupant">' + contacts[id].full_name + '</span>';
                            html += '</a>';
                        }
                    }
                    html += '</div>';
                }

                $('.l-chat[data-dialog="' + dialogId + '"] .j-chatOccupants').append($(html));

                if (dialog.get('type') === 3 && (!status || status.subscription === 'none')) {
                    $('.l-chat:visible').addClass('is-request');
                }

                if (!VoiceMessage.supported) {
                    VoiceMessage.blockRecorder();
                }
            }
        },

        createGroupChat: function (type, dialogId) {
            /* eslint-disable max-len */
            var contacts = ContactList.contacts;
            var newMembers = $('#popupContacts .is-chosen');
            var occupantsIds = $('#popupContacts').data('existing_ids') || [];
            var groupName = occupantsIds.length > 0 ? [User.contact.full_name, contacts[occupantsIds[0]].full_name] : [User.contact.full_name];
            var occupantsNames = !type && occupantsIds.length > 0 ? [contacts[occupantsIds[0]].full_name] : [];
            var newIds = [];
            var name;
            var len;
            var i;
            /* eslint-enable max-len */

            for (i = 0, len = newMembers.length; i < len; i++) {
                name = $(newMembers[i]).find('.name').text();
                if (groupName.length < 3) groupName.push(name);
                occupantsNames.push(name);
                occupantsIds.push($(newMembers[i]).data('id').toString());
                newIds.push($(newMembers[i]).data('id').toString());
            }

            groupName = groupName.join(', ');
            occupantsNames = occupantsNames.join(', ');
            occupantsIds = occupantsIds.join();

            self.createDataSpinner(null, true);
            if (type) {
                Dialog.updateGroup(occupantsNames, {
                    dialog_id: dialogId,
                    occupants_ids: occupantsIds,
                    new_ids: newIds
                }, function (dialog) {
                    var dialogItem;
                    var copyDialogItem;

                    self.removeDataSpinner();
                    dialogItem = $('.l-list-wrap section:not(#searchList) .dialog-item[data-dialog="' + dialog.get('id') + '"]');

                    if (dialogItem.length > 0) {
                        copyDialogItem = dialogItem.clone();
                        dialogItem.remove();
                        $('#recentList ul.j-list').prepend(copyDialogItem);
                        if (!$('#searchList').is(':visible')) {
                            $('#recentList').removeClass('is-hidden');
                            Helpers.Dialogs.isSectionEmpty($('#recentList ul.j-list'));
                        }
                    }
                    $('.is-overlay:not(.chat-occupants-wrap)').removeClass('is-overlay');
                });
            } else {
                Dialog.createGroup(occupantsNames, {
                    name: groupName,
                    occupants_ids: occupantsIds,
                    type: 2
                }, function (dialog) {
                    self.removeDataSpinner();
                    $('.is-overlay:not(.chat-occupants-wrap)').removeClass('is-overlay');
                    $('[data-dialog="' + dialogId + '"] .contact').click();
                    $('.dialog-item[data-dialog="' + dialog.get('id') + '"]').find('.contact').click();
                });
            }
        },

        deleteChat: function (dialogParam, sameUser) {
            var dialogs = Entities.Collections.dialogs;
            var dialogId = (typeof dialogParam === 'string') ? dialogParam : dialogParam.data('dialog');
            var dialog = dialogs.get(dialogId);

            // reset recorder state
            VoiceMessage.resetRecord(dialogId);

            if (!sameUser) {
                Dialog.deleteChat(dialog);
            }

            self.removeDialogItem(dialogId);
        },

        removeDialogItem: function (dialogId) {
            var $dialogItem = $('.dialog-item[data-dialog="' + dialogId + '"]');
            var $chat = $('.l-chat[data-dialog="' + dialogId + '"]');
            var $dialogList = $dialogItem.parents('ul');
            var $mediacall = $chat.find('.mediacall');

            if ($mediacall.length > 0) {
                $mediacall.find('.btn_hangup').click();
            }

            $dialogItem.remove();

            Helpers.Dialogs.isSectionEmpty($dialogList);

            // delete chat section
            if ($chat.is(':visible')) {
                $('.j-capBox').removeClass('is-hidden')
                    .siblings().removeClass('is-active');

                $('.j-chatWrap').addClass('is-hidden')
                    .children().remove();
            }

            if (Entities.active === dialogId) {
                Entities.active = '';
            }

            if ($chat.length > 0) {
                $chat.remove();
            }
        },

        removeForbiddenDialog: function (dialogId) {
            var dialogs = Entities.Collections.dialogs;
            var $mediacall = $('.mediacall');

            if ($mediacall.length > 0) {
                $mediacall.find('.btn_hangup').click();
            }

            this.removeDialogItem(dialogId);
            this.decUnreadCounter(dialogId);

            dialogs.remove(dialogId);

            return false;
        },

        showChatWithNewMessages: function (dialogId, unreadCount, messages) {
            var MessageView = this.app.views.Message;
            var lastReaded;
            var message;
            var count;

            var MIN_STACK = QMCONFIG.stackMessages;
            var MAX_STACK = 100;
            var lessThenMinStack = unreadCount < MIN_STACK;
            var moreThenMinStack = unreadCount > (MIN_STACK - 1);
            var lessThenMaxStack = unreadCount < MAX_STACK;

            if (lessThenMinStack) {
                lastReaded = unreadCount;
                count = MIN_STACK;
            } else if (moreThenMinStack && lessThenMaxStack) {
                lastReaded = unreadCount;
                count = unreadCount + 1;
            } else {
                lastReaded = MAX_STACK - 1;
                count = MAX_STACK;
            }

            self.createDataSpinner(true);

            if (messages) {
                addItems(messages);
            } else {
                messages = []; // eslint-disable-line no-param-reassign

                Message.download(dialogId, function (response, error) {
                    if (error) {
                        if (error.code === 403) {
                            self.removeForbiddenDialog(dialogId);
                        } else {
                            self.removeDataSpinner();

                            errorMessagesLoadingID = setTimeout(function () {
                                self.showChatWithNewMessages(dialogId, unreadCount, messages);
                            }, UPDATE_PERIOD);
                        }
                    } else {
                        clearTimeout(errorMessagesLoadingID);

                        _.each(response, function (item) {
                            messages.push(Message.create(item));
                        });

                        addItems(messages);
                    }
                }, count);
            }

            function addItems(items) {
                var $history;
                var len;
                var i;

                $history = $('section.l-chat-content').children('div:not(.spinner_bounce)');
                $history.css('opacity', '0');

                for (i = 0, len = items.length; i < len; i++) {
                    message = items[i];
                    message.stack = Message.isStack(false, items[i], items[i + 1]);

                    if (unreadCount) {
                        switch (i) {
                        case (lastReaded - 1):
                            message.stack = false;
                            break;
                        case lastReaded:
                            setLabelForNewMessages(dialogId);
                            break;
                        default:
                            break;
                        }
                    }

                    MessageView.addItem(message, null, null);
                }

                setScrollToNewMessages('#mCS_' + dialogId);

                setTimeout(function () {
                    self.removeDataSpinner();
                    $history.css('opacity', '1');
                }, 150);
            }
        },

        validateAvatar: function (params) {
            var img = new Image();

            img.addEventListener('load', function () {
                img = undefined;
            });

            img.addEventListener('error', function () {
                setTimeout(function () {
                    var avatar = document.querySelector('.j-dialogItem[data-dialog="' + params.dialogId + '"] .j-avatar');
                    var user;
                    var dialog;

                    avatar.style.backgroundImage = '';

                    if (params.privateId) {
                        user = ContactList.contacts[params.privateId];

                        user.avatar_url = QMCONFIG.defAvatar.url;
                        avatar.classList.add('default_single_avatar');
                    } else {
                        dialog = Entities.Collections.dialogs.get(params.dialogId);

                        dialog.set('room_photo', QMCONFIG.defAvatar.group_url);
                        avatar.classList.add('default_group_avatar');
                    }
                }, 100);

                img = undefined;
            });

            img.src = params.iconURL;
        }

    };

    /* Private
    ---------------------------------------------------------------------- */
    function messageScrollbar(selector) {
        var isBottom;

        $(selector).mCustomScrollbar({
            theme: 'minimal-dark',
            scrollInertia: 0,
            mouseWheel: {
                scrollAmount: 120
            },
            callbacks: {
                onTotalScrollBack: function () {
                    ajaxDownloading(selector);
                },
                onTotalScroll: function () {
                    var $currentDialog = $('.dialog-item.is-selected');
                    var dialogId = $currentDialog.data('dialog');

                    isBottom = Helpers.isBeginOfChat();

                    if (isBottom) {
                        $('.j-toBottom').hide();
                        $currentDialog.find('.unread').text('');
                        self.decUnreadCounter(dialogId);
                    }
                },
                onScroll: function () {
                    isBottom = Helpers.isBeginOfChat();

                    if (!isBottom) {
                        $('.j-toBottom').show();
                    }

                    Listeners.setChatViewPosition($(this).find('.mCSB_container').offset().top);
                    isNeedToStopTheVideo();
                }
            }
        });
    }

    function scrollbarAside(destroy) {
        var sidebar = document.getElementById('aside_container');

        if (destroy) {
            Ps.destroy(sidebar);
        } else {
            Ps.initialize(sidebar, {
                wheelSpeed: 1,
                wheelPropagation: true,
                minScrollbarLength: 20
            });

            Listeners.listenToPsTotalEnd(true);
        }
    }

    function textAreaScrollbar(selector) {
        $(selector).niceScroll({
            cursoropacitymax: 0.3,
            railpadding: {
                top: 3,
                bottom: 3,
                right: -13
            },
            smoothscroll: false,
            enablemouselockapi: false,
            cursorwidth: '6px',
            autohidemode: 'scroll',
            enabletranslate3d: false,
            enablekeyboard: false
        });
    }

    // ajax downloading of data through scroll
    function ajaxDownloading(selector) {
        var MessageView = self.app.views.Message;
        var $chat = $('.j-chatItem:visible');
        var dialogId = $chat.data('dialog');
        var $messages = $chat.find('.message');
        var firstMsgId = $messages.first().attr('id');
        var count = $messages.length;
        var message;

        Message.download(dialogId, function (messages, error) {
            var len;
            var i;

            for (i = 0, len = messages.length; i < len; i++) {
                if (error && error.code === 403) {
                    self.removeForbiddenDialog(dialogId);

                    return;
                }

                message = Message.create(messages[i], 'ajax');
                message.stack = Message.isStack(false, messages[i], messages[i + 1]);

                MessageView.addItem(message, true, null);

                if ((i + 1) === len) {
                    $(selector).mCustomScrollbar('scrollTo', '#' + firstMsgId);
                }
            }
        }, count, 'ajax');
    }

    function openPopup(objDom) {
        objDom.add('.popups').addClass('is-overlay');
    }

    function getStatus(status) {
        var str = '';

        if (!status || status.subscription === 'none') {
            str += '<span class="status status_request"></span>';
        } else if (status && status.status) {
            str += '<span class="status status_online"></span>';
        } else {
            str += '<span class="status"></span>';
        }

        return str;
    }

    function setLabelForNewMessages(dialogId) {
        var $chatContainer = $('.l-chat[data-dialog="' + dialogId + '"]').find('.l-chat-content .mCSB_container');
        var $newMessages = $('<div class="new_messages j-newMessages" data-dialog="' + dialogId + '">'
                + '<span class="newMessages">New messages</span></div>');

        $chatContainer.prepend($newMessages);
    }

    function setScrollToNewMessages(selector) {
        var $chat = $('.j-chatItem:visible');
        var isBottom = Helpers.isBeginOfChat();
        var isScrollDragger = $chat.find('.mCSB_draggerContainer').length;

        if ($('.j-newMessages').length) {
            scrollToThrArea('.j-newMessages');
            if (!isBottom && isScrollDragger) {
                $('.j-toBottom').show();
            }
        } else {
            scrollToThrArea('bottom');
        }

        function scrollToThrArea(area) {
            $(selector).mCustomScrollbar('scrollTo', area);
        }
    }

    function removeNewMessagesLabel(dialogId, curDialogId) {
        var $label = $('.j-newMessages[data-dialog="' + dialogId + '"]');

        if ($label.length && (dialogId !== curDialogId)) {
            $label.remove();
        }
    }

    function isNeedToStopTheVideo() {
        $('.j-videoPlayer').each(function (index, element) {
            var $element = $(element);

            if (!element.paused) {
                if (($element.offset().top <= 0) || ($element.offset().top >= 750)) {
                    element.pause();
                }
            }
        });
    }

    return DialogView;
});
