'use strict';

const $ = require('jquery');
const QMCONFIG = require('config');
const Helpers = require('Helpers');
const QMHtml = require('QMHtml');
const Location = require('LocationView');
const Ps = require('perfectscrollbar');

require('mCustomScrollbar');
require('mousewheel');

/*
 * Q-municate chat application
 *
 * Events Module
 *
 */
let User;
let Dialog;
let Cursor;
let UserView;
let ContactList;
let ContactListView;
let DialogView;
let MessageView;
let AttachView;
let VideoChatView;
let SettingsView;
let VoiceMessage;

let chatName;
let editedChatName;
let stopTyping;
let retryTyping;
let keyupSearch;

let App;

const $workspace = $('.l-workspace-wrap');
const $body = $('body');

function Events(app) {
    App = app;
    this.app = app;

    /* eslint-disable prefer-destructuring */
    Dialog = this.app.models.Dialog;
    Cursor = this.app.models.Cursor;
    User = this.app.models.User;
    UserView = this.app.views.User;
    ContactList = this.app.models.ContactList;
    ContactListView = this.app.views.ContactList;
    DialogView = this.app.views.Dialog;
    MessageView = this.app.views.Message;
    AttachView = this.app.views.Attach;
    VideoChatView = this.app.views.VideoChat;
    SettingsView = this.app.views.Settings;
    VoiceMessage = this.app.models.VoiceMessage;
    /* eslint-enable prefer-destructuring */
}

Events.prototype = {

    init() {
        window.isQMAppActive = true;

        $(window).focus(() => {
            window.isQMAppActive = true;

            const dialogItem = $('.l-list-wrap section:not(#searchList) .is-selected');
            const dialogId = dialogItem[0] && dialogItem.data('dialog');

            if (dialogId) {
                dialogItem.find('.unread').text('');
                DialogView.decUnreadCounter(dialogId);
            }
        });

        $(window).blur(() => {
            const $chat = $('.l-chat:visible');
            const $label = $('.l-chat:visible').find('.j-newMessages');

            if ($chat.length && $label.length) {
                $label.remove();
            }

            window.isQMAppActive = false;
        });

        $(document).on('click', (event) => {
            clickBehaviour(event);
        });

        $('.popups').on('click', (event) => {
            const objDom = $(event.target);

            if (objDom.is('.popups') && !objDom.find('.popup.is-overlay').is('.is-open')) {
                closePopup();
            }
        });

        $('#signup-avatar:file').on('change', function() {
            changeInputFile($(this));
        });

        /* User Profile
        ----------------------------------------------------- */
        $body.on('click', '.userDetails, .j-userMenu', function(event) {
            removePopover();

            const id = $(this).data('id');
            const roster = ContactList.roster[id];

            if (roster) {
                QMHtml.User.getControlButtonsForPopupDetails(roster);
                openPopup($('#popupDetails'), id);
                UserView.buildDetails(id);
            } else {
                removePopover();
                UserView.occupantPopover($(this), event);
            }

            return false;
        });

        $body.on('click', '#userProfile', (event) => {
            const profileView = App.views.Profile;

            event.preventDefault();
            removePopover();
            profileView.render().openPopup();
        });

        $body.on('click', '.btn_changePassword', (event) => {
            const changePassView = App.views.ChangePass;
            const profileView = App.views.Profile;

            event.preventDefault();
            profileView.$el.hide();
            changePassView.render().openPopup();
        });

        $body.on('click', '.btn_popup_changepass', (event) => {
            const changePassView = App.views.ChangePass;

            event.preventDefault();
            changePassView.submitForm();
        });

        $body.on('click', '.btn_userProfile_connect', function() {
            const profileView = App.views.Profile;
            const btn = $(this);

            btn.prop('disabled', true);

            FB.login(
                (response) => {
                    Helpers.log('FB authResponse', response);
                    if (response.status === 'connected') {
                        profileView.addFBAccount(response.authResponse.userID);
                    } else {
                        btn.prop('disabled', false);
                    }
                }, {
                    scope: QMCONFIG.fbAccount.scope,
                },
            );
        });

        /* smiles
        ----------------------------------------------------- */
        $('.smiles-tab').on('click', function() {
            const $self = $(this);
            const smile = document.querySelector('.smiles-wrap');
            const group = $self.data('group');

            $self.addClass('is-actived')
                .siblings().removeClass('is-actived');

            $(`.smiles-group_${group}`).removeClass('is-hidden')
                .siblings().addClass('is-hidden');

            smile.scrollTop = 0;
            Ps.update(smile);

            Cursor.setCursorToEnd($('.l-chat:visible .textarea')[0]);
        });

        Ps.initialize(document.querySelector('.smiles-wrap'), {
            wheelSpeed: 1,
            wheelPropagation: true,
            minScrollbarLength: 20,
        });

        $workspace.on('click', '.j-em', function() {
            Cursor.setCursorAfterElement($(this)[0]);

            return false;
        });


        $('.j-em_wrap').on('click', function(event) {
            const target = $(this).children()[0];
            const textarea = $('.l-chat:visible .textarea')[0];

            if (target === event.target) {
                textarea.focus();
                Cursor.insertElement(target, 'j-em');
            } else {
                Cursor.setCursorToEnd(textarea);
            }

            return false;
        });

        /* attachments
        ----------------------------------------------------- */
        $workspace.on('click', '.j-btn_input_attach', function() {
            $(this).parents('.l-chat-footer')
                .find('.attachment')
                .click();
        });

        $workspace.on('change', '.attachment', function() {
            AttachView.changeInput($(this));
        });

        $workspace.on('click', '.attach-cancel', function(event) {
            event.preventDefault();
            AttachView.cancel($(this));
        });

        $workspace.on('click', '.preview', function() {
            const $self = $(this);
            const name = $self.data('name');
            const url = $self.data('url');
            let attachType;

            if ($self.is('.preview-photo')) {
                attachType = 'photo';
                setAttachType(attachType);
            } else {
                attachType = 'video';
                setAttachType(attachType);
            }

            openAttachPopup($('#popupAttach'), name, url, attachType);
        });

        /* location
        ----------------------------------------------------- */
        $workspace.on('click', '.j-send_location', () => {
            if (localStorage['QM.latitude'] && localStorage['QM.longitude']) {
                Location.toggleGeoCoordinatesToLocalStorage(false, (res, err) => {
                    Helpers.log(err || res);
                });
            } else {
                Location.toggleGeoCoordinatesToLocalStorage(true, (res, err) => {
                    Helpers.log(err || res);
                });
            }
        });

        $workspace.on('click', '.j-btn_input_location', function() {
            const $self = $(this);
            const $gmap = $('.j-popover_gmap');
            const bool = $self.is('.is-active');

            removePopover();

            if (!bool) {
                $self.addClass('is-active');
                $gmap.addClass('is-active');

                Location.addMap($gmap);
            }
        });

        $workspace.on('click', '.j-send_map', () => {
            const localData = localStorage['QM.locationAttach'];

            if (localData) {
                AttachView.sendMessage($('.l-chat:visible'), null, null, localData);
                localStorage.removeItem('QM.locationAttach');
                removePopover();
            }
        });

        $body.on('keypress', (e) => {
            if ((e.keyCode === 13) && $('.j-open_map').length) {
                $('.j-send_map').click();
            }
        });

        /* user settings
        ----------------------------------------------------- */
        $body.on('click', '#userSettings', () => {
            removePopover();
            $('.j-settings').addClass('is-overlay')
                .parent('.j-overlay').addClass('is-overlay');

            return false;
        });

        $body.on('click', '.j-close_settings', () => {
            closePopup();

            return false;
        });

        $('.j-toogle_settings').click(function() {
            const $target = $(this).find('.j-setings_notify')[0];
            const obj = {};

            $target.checked = $target.checked !== true;
            obj[$target.id] = $target.checked;

            SettingsView.update(obj);

            return false;
        });

        /* group chats
        ----------------------------------------------------- */
        $workspace.on('click', '.j-triangle', () => {
            const $chat = $('.l-chat:visible');
            const $scroll = $chat.find('.j-scrollbar_message');

            if ($chat.find('.triangle_up').is('.is-hidden')) {
                $scroll.mCustomScrollbar('scrollTo', '-=94');
                setTriagle('up');
            } else {
                $scroll.mCustomScrollbar('scrollTo', '+=94');
                setTriagle('down');
            }

            return false;
        });

        $workspace.on('click', '.groupTitle .addToGroupChat', function(event) {
            const $self = $(this);
            const dialogId = $self.data('dialog');

            event.stopPropagation();

            Helpers.log('add people to groupchat');
            ContactListView.addContactsToChat($self, 'add', dialogId);
        });

        $workspace.on('click', '.groupTitle .leaveChat, .groupTitle .avatar', (event) => {
            event.stopPropagation();
        });

        /* change the chat name
        ----------------------------------------------------- */
        $workspace.on('mouseenter focus', '.groupTitle .name_chat', () => {
            const $chat = $('.l-chat:visible');
            $chat.find('.triangle:visible').addClass('is-hover')
                .siblings('.pencil').removeClass('is-hidden');

            return false;
        });

        $workspace.on('mouseleave', '.groupTitle .name_chat', function() {
            const $chat = $('.l-chat:visible');

            if (!$(this).is('.is-focus')) {
                $chat.find('.triangle.is-hover').removeClass('is-hover')
                    .siblings('.pencil').addClass('is-hidden');
            }

            return false;
        });

        $(document.body).on('click', () => {
            const $chat = $('.l-chat:visible');

            if ($chat.find('.groupTitle .name_chat').is('.is-focus')) {
                $chat.find('.groupTitle .name_chat').removeClass('is-focus');
                $chat.find('.groupTitle .name_chat')[0].scrollLeft = 0;
                $chat.find('.triangle.is-hover').removeClass('is-hover')
                    .siblings('.pencil').addClass('is-hidden');

                if (editedChatName && !editedChatName.name) {
                    $chat.find('.name_chat').text(chatName.name);
                } else if (editedChatName
                    && (editedChatName.name !== chatName.name)
                    && (editedChatName.created_at > chatName.created_at)) {
                    $chat.find('.name_chat').text(editedChatName.name).attr('title', editedChatName.name);
                    Dialog.changeName($chat.data('dialog'), editedChatName.name);
                } else {
                    $chat.find('.name_chat').text($chat.find('.name_chat').text().trim());
                }
            }
        });

        $body.on('click', '.groupTitle .name_chat', function(event) {
            const $self = $(this);

            event.stopPropagation();

            $self.addClass('is-focus');
            chatName = {
                name: $self.text().trim(),
                created_at: Date.now(),
            };
            removePopover();
        });

        $body.on('keypress', '.groupTitle .name_chat', function(event) {
            const $self = $(this);
            const code = event.keyCode;

            editedChatName = {
                name: $self.text().trim(),
                created_at: Date.now(),
            };
            if (code === 13) {
                $(document.body).click();
                $self.blur();
            } else if (code === 27) {
                editedChatName = null;
                $self.text(chatName.name);
                $(document.body).click();
                $self.blur();
            }
        });

        /* change the chat avatar
        ----------------------------------------------------- */
        $body.on('click', '.j-changePic', function() {
            const dialogId = $(this).data('dialog');

            $(`input:file[data-dialog="${dialogId}"]`).click();
        });

        $workspace.on('change', '.groupTitle .avatar_file', function() {
            const $chat = $('.l-chat:visible');

            Dialog.changeAvatar($chat.data('dialog'), $(this), (avatar) => {
                if (!avatar) {
                    return;
                }

                $chat.find('.avatar_chat').css('background-image', `url(${avatar})`);
                $('.j-popupAvatar .j-avatarPic').attr('src', avatar);
            });
        });

        $workspace.on('click', '.j-scaleAvatar', function() {
            Helpers.scaleAvatar($(this));
        });

        /* scrollbars
        ----------------------------------------------------- */
        occupantScrollbar();

        /* welcome page
        ----------------------------------------------------- */
        Events.intiAuthorizationInputs();

        $('.j-btn_login_fb').on('click', function() {
            if ($(this).hasClass('j-reloadPage')) {
                window.location.reload();
            }

            if (window.FB) {
                UserView.logInFacebook();
            } else {
                $('.j-btn_login_fb').addClass('not_allowed j-reloadPage')
                    .html('Login by Facebook failed.<br>Click to reload the page.');
            }

            return false;
        });

        $('.j-firebasePhone').on('click', function() {
            if ($(this).hasClass('j-reloadPage')) {
                window.location.reload();
            }

            if (window.firebase) {
                UserView.logInFirebase();
            } else {
                $('.j-firebasePhone').addClass('not_allowed j-reloadPage')
                    .html('Login by phone number failed.<br>Click to reload the page.');
            }

            return false;
        });

        $('#signupQB').on('click', () => {
            Helpers.log('signup with QB');
            UserView.signupQB();
        });

        $('.j-login_QB').on('click', () => {
            Helpers.log('login wih QB');

            // removed class "active" (hotfix for input on qmdev.quickblox.com/qm.quickblox.com)
            $('#loginPage .j-prepare_inputs').removeClass('active');
            UserView.loginQB();

            return false;
        });

        /* button "back"
        ----------------------------------------------------- */
        $('.j-back_to_login_page').on('click', () => {
            UserView.loginQB();
            $('.j-success_callback').remove();
        });

        /* signup page
        ----------------------------------------------------- */
        $('#signupForm').on('click submit', (event) => {
            Helpers.log('create user');
            event.preventDefault();
            UserView.signupForm();
        });

        /* login page
        ----------------------------------------------------- */
        $('#forgot').on('click', (event) => {
            Helpers.log('forgot password');
            event.preventDefault();
            UserView.forgot();
        });

        $('#loginForm').on('click submit', (event) => {
            Helpers.log('authorize user');
            event.preventDefault();
            UserView.loginForm();
        });

        /* forgot and reset page
        ----------------------------------------------------- */
        $('#forgotForm').on('click submit', (event) => {
            Helpers.log('send letter');
            event.preventDefault();
            UserView.forgotForm();
        });

        $('#resetForm').on('click submit', (event) => {
            Helpers.log('reset password');
            event.preventDefault();
            UserView.resetForm();
        });

        /* popovers
        ----------------------------------------------------- */
        $('#profile').on('click', function(event) {
            event.preventDefault();
            removePopover();
            if ($('.l-chat:visible').find('.triangle_down').is('.is-hidden')) {
                setTriagle('down');
            }
            UserView.profilePopover($(this));
        });

        $('.list_contextmenu').on('contextmenu', '.contact', function() {
            removePopover();
            UserView.contactPopover($(this));

            return false;
        });

        $workspace.on('click', '.occupant', function(event) {
            removePopover();
            UserView.occupantPopover($(this), event);

            return false;
        });

        $workspace.on('click', '.j-btn_input_smile', function() {
            const $self = $(this);
            const bool = $self.is('.is-active');

            removePopover();

            if (!bool) {
                $self.addClass('is-active');
                $('.j-popover_smile').addClass('is-active');
            }

            Cursor.setCursorToEnd($('.l-chat:visible .textarea')[0]);
        });

        $workspace.on('click', '.j-btn_audio_record', function() {
            const $self = $(this);
            const bool = $self.is('.is-active');

            removePopover();

            if (!bool) {
                $self.addClass('is-active');
                $('.j-popover_record').addClass('is-active');
            }
        });

        /* popups
        ----------------------------------------------------- */
        $body.on('click', '#logout', (event) => {
            event.preventDefault();
            openPopup($('#popupLogout'));
        });

        // delete contact
        $body.on('click', '.j-deleteContact', function() {
            const $that = $(this);

            closePopup();

            const parents = $that.parents('.presence-listener');
            const id = parents.data('id') || $that.data('id');

            if (parents.is('.popup_details')) {
                openPopup($('.j-popupDeleteContact'), id, null, true);
            } else {
                openPopup($('.j-popupDeleteContact'), id);
            }

            return false;
        });

        $('.j-deleteContactConfirm').on('click', function() {
            const id = $(this).parents('.j-popupDeleteContact').data('id');

            ContactListView.sendDelete(id, true);
            Helpers.log('delete contact');
        });

        // delete chat
        $('.list, .l-workspace-wrap').on('click', '.j-deleteChat', function() {
            const $self = $(this);

            closePopup();

            const parent = $self.parents('.presence-listener')[0] ? $self.parents('.presence-listener') : $self.parents('.is-group');
            const dialogId = parent.data('dialog');

            openPopup($('.j-popupDeleteChat'), null, dialogId);

            return false;
        });

        $('.j-deleteChatConfirm').on('click', function() {
            Helpers.log('Delete chat');
            DialogView.deleteChat($(this));
        });

        $('#logoutConfirm').on('click', () => {
            localStorage.setItem(`QM.${User.contact.id}_logOut`, true);
            UserView.logout();
        });

        $('.popup-control-button, .btn_popup_private').on('click', function(event) {
            const $self = $(this);
            const isProfile = $self.data('isprofile');

            event.preventDefault();

            if (!$self.is('.returnBackToPopup')) {
                closePopup();
            }

            if (isProfile) {
                openPopup($('#popupDetails'));
            }
        });

        $('.search').on('click', () => {
            Helpers.log('global search');
            closePopup();
            ContactListView.globalPopup();
        });

        $('.btn_search').on('click', (event) => {
            const localSearch = $('#searchContacts input');
            const globalSearch = $('#globalSearch input');

            event.preventDefault();

            globalSearch.val(localSearch.val());
            $('#globalSearch').submit();
        });

        $('#mainPage').on('click', '.createGroupChat', function(event) {
            const $self = $(this);
            const isPrivate = $self.data('private');

            event.preventDefault();

            Helpers.log('add people to groupchat');
            ContactListView.addContactsToChat($self, null, null, isPrivate);
        });

        $('.l-sidebar').on('click', '.addToGroupChat', function(event) {
            const $self = $(this);
            const dialogId = $self.data('dialog');

            event.preventDefault();

            Helpers.log('add people to groupchat');
            ContactListView.addContactsToChat($self, 'add', dialogId);
        });

        /* search
        ----------------------------------------------------- */
        $('.j-globalSearch').on('keyup search submit', function(event) {
            const $self = $(this);
            const code = event.keyCode;
            const isText = $self.find('.form-input-search').val().length;
            const $cleanButton = $self.find('.j-clean-button');
            const isNoBtn = $cleanButton.is(':hidden');

            if (code === 13) {
                clearTimeout(keyupSearch);
                startSearch();
            } else if (keyupSearch === undefined) {
                keyupSearch = setTimeout(() => {
                    startSearch();
                }, (code === 8) ? 0 : 1000);
            } else {
                clearTimeout(keyupSearch);
                keyupSearch = setTimeout(() => {
                    startSearch();
                }, 1000);
            }

            function startSearch() {
                keyupSearch = undefined;
                ContactListView.globalSearch($self);
            }

            if (isText && isNoBtn) {
                $cleanButton.show();
            } else if (!isText) {
                $cleanButton.hide();
            }

            return false;
        });

        $('.localSearch').on('keyup search submit', function(event) {
            const $self = $(this);
            const scrollbar = document.querySelector('.j-scrollbar_aside');
            const isText = $self.find('.form-input-search').val().length;
            const $cleanButton = $self.find('.j-clean-button');
            const isNoBtn = $cleanButton.is(':hidden');
            const { type } = event;
            const code = event.keyCode; // code=27 (Esc key), code=13 (Enter key)

            if ((type === 'keyup' && code !== 27 && code !== 13) || (type === 'search')) {
                if (this.id === 'searchContacts') {
                    UserView.localSearch($self);
                } else {
                    UserView.friendsSearch($self);
                }

                Ps.update(scrollbar);
            }

            if (isText && isNoBtn) {
                $cleanButton.show();
            } else if (!isText) {
                $cleanButton.hide();
            }

            return false;
        });

        $('.j-clean-button').on('click', function() {
            const $self = $(this);
            const $form = $self.parent('form.formSearch');

            $self.hide();
            $form.find('input.form-input-search').val('').focus();

            if ($form.is('.j-globalSearch')) {
                ContactListView.globalSearch($form);
            } else if ($form.is('.j-localSearch')) {
                UserView.localSearch($form);
            } else {
                UserView.friendsSearch($form);
            }

            return false;
        });

        /* subscriptions
        ----------------------------------------------------- */
        function sendRequest(el) {
            const jid = $(el).parents('.j-listItem').data('jid');

            ContactListView.sendSubscribe(jid);
            Helpers.log('send subscribe');
        }

        $('.list_contacts').on('click', '.j-sendRequest', function() {
            sendRequest(this);
        });

        $workspace.on('click', '.j-requestAgain', function() {
            const jid = $(this).parents('.j-chatItem').data('jid');

            ContactListView.sendSubscribe(jid, true);
            Helpers.log('send subscribe');
        });

        $body.on('click', '.j-requestAction', function() {
            sendRequest(this);
        });

        $('.list').on('click', '.j-requestConfirm', function() {
            const jid = $(this).parents('.j-incomingContactRequest').data('jid');

            ContactListView.sendConfirm(jid, true);
            Helpers.log('send confirm');
        });

        $('.list').on('click', '.j-requestCancel', function() {
            const jid = $(this).parents('.j-incomingContactRequest').data('jid');

            ContactListView.sendReject(jid, true);
            Helpers.log('send reject');
        });

        /* dialogs
        ----------------------------------------------------- */
        $('.list').on('click', '.contact', (event) => {
            if (event.target.tagName !== 'INPUT') {
                event.preventDefault();
            }
        });

        $('#popupContacts').on('click', '.contact', function() {
            const obj = $(this).parent();
            const popup = obj.parents('.popup');

            if (obj.is('.is-chosen')) {
                obj.removeClass('is-chosen').find('input').prop('checked', false);
            } else {
                obj.addClass('is-chosen').find('input').prop('checked', true);
            }

            const len = obj.parent().find('li.is-chosen').length;

            if (len === 1 && !popup.is('.is-addition')) {
                popup.removeClass('not-selected');
                popup.find('.btn_popup_private').removeClass('is-hidden').siblings().addClass('is-hidden');

                if (obj.is('li:last')) {
                    popup.find('.list_contacts').mCustomScrollbar('scrollTo', 'bottom');
                }
            } else if (len >= 1) {
                popup.removeClass('not-selected');

                if (popup.is('.add')) {
                    popup.find('.btn_popup_add').removeClass('is-hidden').siblings().addClass('is-hidden');
                } else {
                    popup.find('.btn_popup_group').removeClass('is-hidden').siblings().addClass('is-hidden');
                }

                if (obj.is('li:last')) {
                    popup.find('.list_contacts').mCustomScrollbar('scrollTo', 'bottom');
                }
            } else {
                popup.addClass('not-selected');
            }
        });

        $('#popupContacts .btn_popup_private').on('click', () => {
            const id = $('#popupContacts .is-chosen').data('id');
            let dialogItem = $(`.j-dialogItem[data-id="${id}"]`).find('.contact');

            if (dialogItem.length) {
                dialogItem.click();
            } else {
                Dialog.restorePrivateDialog(id, () => {
                    dialogItem = $(`.j-dialogItem[data-id="${id}"]`).find('.contact');
                    dialogItem.click();
                });
            }
        });

        $body.on('click', '.writeMessage', function(event) {
            const id = $(this).data('id');
            let dialogItem = $(`.j-dialogItem[data-id="${id}"]`).find('.contact');

            event.preventDefault();

            closePopup();

            if (dialogItem.length) {
                dialogItem.click();
            } else {
                Dialog.restorePrivateDialog(id, () => {
                    dialogItem = $(`.j-dialogItem[data-id="${id}"]`).find('.contact');
                    dialogItem.click();
                });
            }
        });

        $('#popupContacts .btn_popup_group').on('click', () => {
            DialogView.createGroupChat();
        });

        $('#popupContacts .btn_popup_add').on('click', function() {
            const dialogId = $(this).parents('.popup').data('dialog');
            DialogView.createGroupChat('add', dialogId);
        });

        $workspace.on('click', '.j-btn_input_send', () => {
            const $msg = $('.j-message:visible');
            const isLoading = $('.j-loading').length;

            if (!isLoading) {
                MessageView.sendMessage($msg);
                $msg.find('.textarea').empty();
            }

            removePopover();

            Cursor.setCursorToEnd($('.l-chat:visible .textarea')[0]);

            return false;
        });

        // show message status on hover event
        $body.on('mouseenter', 'article.message.is-own', function() {
            const $self = $(this);
            const time = $self.find('.message-time');
            const status = $self.find('.message-status');

            time.addClass('is-hidden');
            status.removeClass('is-hidden');
        });

        $body.on('mouseleave', 'article.message.is-own', function() {
            const $self = $(this);
            const time = $self.find('.message-time');
            const status = $self.find('.message-status');

            status.addClass('is-hidden');
            time.removeClass('is-hidden');
        });

        /* A button for the scroll to the bottom of chat
        ------------------------------------------------------ */
        $body.on('click', '.j-refreshButton', function() {
            const $this = $(this);
            const dialogId = $this.data('dialog');

            if (dialogId.length) {
                DialogView.htmlBuild(dialogId);
            } else {
                DialogView.downloadDialogs();
            }

            $this.remove();

            return false;
        });

        $workspace.on('click', '.j-toBottom', function() {
            $('.j-scrollbar_message').mCustomScrollbar('scrollTo', 'bottom');
            $(this).hide();
        });

        $workspace.on('click', '.j-videoPlayer', (e) => {
            const video = e.target;

            if (!video.dataset.source) return;

            video.src = video.dataset.source;
            video.preload = 'auto';
            video.poster = 'images/video_loader.gif';
            video.addEventListener('loadeddata', isReady);

            function isReady() {
                delete this.dataset.source;
                this.removeEventListener('loadeddata', isReady);
                this.poster = '';
                this.controls = true;
                this.autoplay = true;
                this.load();
            }
        });

        // send typing statuses with keyup event
        $workspace.on('keypress', '.j-message', function(event) {
            const $self = $(this);
            const isEnterKey = (event.keyCode === 13);
            const { shiftKey } = event;
            const $chat = $self.parents('.l-chat');
            const jid = $chat.data('jid');
            const isLoading = $chat.find('.j-loading').length;
            const isEmpty = !$chat.find('.textarea').html().length;

            if (isEnterKey && (isLoading || isEmpty)) {
                return;
            } if (isEnterKey && !shiftKey) {
                isStopTyping();
                MessageView.sendMessage($self);
                $self.find('.textarea').empty();
                removePopover();
                return;
            } if (stopTyping === undefined) {
                isStartTyping();
                stopTyping = setTimeout(isStopTyping, 4000);
                retryTyping = setInterval(isStartTyping, 4000);
            } else {
                clearTimeout(stopTyping);
                stopTyping = setTimeout(isStopTyping, 4000);
            }

            function isStartTyping() {
                MessageView.sendTypingStatus(jid, true);
            }

            function isStopTyping() {
                clearTimeout(stopTyping);
                stopTyping = undefined;

                clearInterval(retryTyping);
                retryTyping = undefined;

                MessageView.sendTypingStatus(jid, false);
            }
        });

        $(document).on('keypress', (event) => {
            if (event.keyCode === 13 && $('.j-popover_record').hasClass('is-active')) {
                $('.j-record_title').click();
            }
        });

        $workspace.on('click', '.j-message', () => {
            if ($('.j-popover_record').hasClass('is-active')) {
                removePopover();
            }
        });

        $workspace.on('submit', '.j-message', () => false);

        $workspace.on('keypress', '.j-message', () => {
            const $textarea = $('.l-chat:visible .textarea');
            const $emj = $textarea.find('.j-em');
            const val = $textarea.text().trim();

            if (val.length || $emj.length) {
                $textarea.addClass('contenteditable');
            } else {
                $textarea.removeClass('contenteditable').empty();
                Cursor.setCursorToEnd($textarea[0]);
            }
        });

        $body.on('paste', '.j-message', (e) => {
            const text = (e.originalEvent || e).clipboardData.getData('text/plain');
            document.execCommand('insertText', false, text);

            return false;
        });

        $('.j-home').on('click', () => {
            const $selected = $('.is-selected');
            const dialogId = $selected.data('dialog');
            const $label = $(`.j-newMessages[data-dialog="${dialogId}"]`);

            VoiceMessage.resetRecord();

            $('.j-capBox').removeClass('is-hidden')
                .siblings().removeClass('is-active');
            $('.j-chatWrap').addClass('is-hidden');

            if ($label.length) {
                $label.remove();
            }

            $selected.removeClass('is-selected');

            return false;
        });

        /* temporary events
        ----------------------------------------------------- */
        $('#share').on('click', (event) => {
            event.preventDefault();
        });

        // videocalls
        VideoChatView.init();
    },
};

Events.intiAuthorizationInputs = function(el) {
    const $input = el || $('.form-input');

    $input.on('focus', function() {
        const $this = $(this);

        if (!$this.val()) {
            $this.next('label').addClass('active');
        }

        return false;
    });

    $input.on('blur', function() {
        const $this = $(this);

        if (!$this.val()) {
            $this.next('label').removeClass('active');
        }

        return false;
    });
};

/* Private
---------------------------------------------------------------------- */
function occupantScrollbar() {
    $('.chat-occupants, #popupIncoming').mCustomScrollbar({
        theme: 'minimal-dark',
        scrollInertia: 500,
        mouseWheel: {
            scrollAmount: 'auto',
            deltaFactor: 'auto',
        },
        live: true,
    });
}

// Checking if the target is not an object run popover
function clickBehaviour(e) {
    const objDom = $(e.target);
    const selectors = '#profile, #profile *, .occupant, .occupant *, '
            + '.j-btn_input_smile, .j-btn_input_smile *, .textarea, '
            + '.textarea *, .j-popover_smile, .j-popover_smile *, '
            + '.j-popover_gmap, .j-popover_gmap *, .j-btn_input_location, '
            + '.j-btn_input_location *, '
            + '.j-popover_record, .j-popover_record *, .j-btn_audio_record, '
            + '.j-btn_audio_record *';
    const googleImage = (objDom.context.src && objDom.context.src.indexOf('/maps.gstatic.com/mapfiles/api-3/images/mapcnt6.png')) || null;

    if (objDom.is(selectors) || e.which === 3 || googleImage === 7) {
        return;
    }
    removePopover();
}

function changeInputFile(objDom) {
    const { URL } = window;
    const file = objDom[0].files[0];
    const src = file ? URL.createObjectURL(file) : QMCONFIG.defAvatar.url;
    const fileName = file ? file.name : QMCONFIG.defAvatar.caption;

    objDom.prev().find('.avatar').css('background-image', `url(${src})`).siblings('span')
        .text(fileName);
}

function removePopover() {
    const $openMap = $('.j-open_map');

    $('.is-contextmenu').removeClass('is-contextmenu');
    $('.popover').remove();

    if ($('.j-start_record').hasClass('is-active')
         || $('.j-start_record').hasClass('is-send')) {
        return;
    }

    $('.is-active').removeClass('is-active');

    if ($openMap.length) {
        $openMap.remove();
    }
}

function openPopup(objDom, id, dialogId, isProfile) {
// if it was the delete action
    if (id) {
        objDom.data('id', id);
        objDom.find('.j-deleteContactConfirm').data('id', id);
    }
    if (dialogId) {
        objDom.find('.j-deleteChatConfirm').data('dialog', dialogId);
    }
    if (isProfile) {
        objDom.find('.popup-control-button_cancel').attr('data-isprofile', true);
    }
    objDom.add('.popups').addClass('is-overlay');
}

function openAttachPopup(objDom, name, url, attachType) {
    if (attachType === 'video') {
        objDom.find('video.attach-video').attr('src', url);
    } else {
        objDom.find('.attach-photo').attr('src', url);
    }

    objDom.find('.attach-name').text(name);
    objDom.find('.attach-download').attr('href', url).attr('download', name);
    objDom.add('.popups').addClass('is-overlay');
}

function closePopup() {
    $('.j-popupDeleteContact.is-overlay').removeData('id');
    $('.j-popupDelete.is-overlay').removeData('id');
    $('.is-overlay:not(.chat-occupants-wrap)').removeClass('is-overlay');
    $('.temp-box').remove();

    if ($('video.attach-video')[0]) {
        $('video.attach-video')[0].pause();
    }

    if ($('img.attach-photo')[0]) {
        $('img.attach-photo').attr('src', 'images/photo_preloader.gif');
    }
}

function setAttachType(type) {
    const otherType = type === 'photo' ? 'video' : 'photo';

    $(`.attach-${type}`).removeClass('is-hidden')
        .siblings(`.attach-${otherType}`).addClass('is-hidden');
}

function setTriagle(UpOrDown) {
    const $chat = $('.l-chat:visible');
    const $triangle = $chat.find(`.triangle_${UpOrDown}`);

    $triangle.removeClass('is-hidden')
        .siblings('.triangle').addClass('is-hidden');

    $chat.find('.chat-occupants-wrap').toggleClass('is-overlay');
    $chat.find('.l-chat-content').toggleClass('l-chat-content_min');
}

module.exports = Events;
