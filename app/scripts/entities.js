'use strict';

const $ = require('jquery');
const _ = require('underscore');
const Backbone = require('backbone');
const QMCONFIG = require('config');
const Helpers = require('Helpers');

/** ****************** Module for dialogs and messages ************************ */
const { QB } = window;

const entities = {
    Models: {},
    Views: {},
    Collections: {},
    Helpers: {},
    active: '',
};

/**
 * [Message model]
 * @type {[Backbone model]}
 */
entities.Models.Message = Backbone.Model.extend({
    defaults: {
        id: '',
        body: '',
        type: '',
        dialog_id: '',
        date_sent: null,
        notification_type: null,
        delivered_ids: [],
        read_ids: [],
        read: null,
        online: false,
        status: '',
    },

    initialize() {
        this.accumulateInDialogModel();
    },

    // accumulate messages in dialogs
    accumulateInDialogModel() {
        const dialogId = this.get('dialog_id');
        const dialog = entities.Collections.dialogs.get(dialogId);

        if (!dialog) {
            return;
        }

        const messageId = this.get('id');
        const type = this.get('type');
        const senderId = this.get('sender_id');
        const readIds = this.get('read_ids');
        const isOpen = dialog.get('opened');
        const myUserId = entities.app.models.User.contact.id;
        const isActive = (dialogId === entities.active);
        const isHidden = (isActive && !window.isQMAppActive);
        const isFromOtherUser = (myUserId !== senderId);
        const isUnreadMessage = (readIds.length < 2);

        if (isOpen) {
            // save as uread if dialog isn't active
            if ((!isActive || isHidden) && isFromOtherUser) {
                new entities.Models.UnreadMessage({ // eslint-disable-line no-new
                    userId: senderId,
                    dialogId,
                    messageId,
                });
            } else if (isUnreadMessage && isFromOtherUser) {
                QB.chat.sendReadStatus({
                    userId: senderId,
                    dialogId,
                    messageId,
                });
            } else if ((type === 'groupchat') && !isFromOtherUser) {
                QB.chat.sendDeliveredStatus({
                    userId: senderId,
                    dialogId,
                    messageId,
                });
            }
            // collect last messages for opened dialog's
            this.addMessageToCollection(dialog.get('messages'));
        }
    },

    addMessageToCollection(collection) {
        const online = this.get('online');

        if (online) {
            collection.unshift(this);
        } else {
            collection.push(this);
        }
    },

});

/**
 * [Messages collection]
 * @type {Backbone.Collection}
 */
entities.Collections.Messages = Backbone.Collection.extend({
    model: entities.Models.Message,

    initialize() {
        this.listenTo(this, 'add', this.keepCountOfMessages);
    },

    // keep count for messages collection
    keepCountOfMessages() {
        const stack = QMCONFIG.stackMessages;
        const dialogId = this.at(0).get('dialog_id');
        const dialog = entities.Collections.dialogs.get(dialogId);
        let unreadCount = dialog.get('unread_count');

        if (
            ((this.length > stack) && (unreadCount < stack))
            // eslint-disable-next-line no-plusplus
            || ((unreadCount >= stack) && (this.length > ++unreadCount))
        ) {
            this.pop();
        }
    },
});

/**
 * [Unread message model]
 * @type {[Backbone model]}
 */
entities.Models.UnreadMessage = Backbone.Model.extend({
    defaults: {
        messageId: '',
        dialogId: '',
        userId: null,
    },

    initialize() {
        this.accumulateInDialogModel();
    },

    accumulateInDialogModel() {
        const dialogId = this.get('dialogId');
        const dialog = entities.Collections.dialogs.get(dialogId);
        let unreadCount = dialog.get('unread_count');
        const unreadMessages = dialog.get('unread_messages');

        unreadCount += 1;

        dialog.set('unread_count', unreadCount);
        unreadMessages.add(this);
    },
});

/**
 * [Unread messages collection]
 * @type {[Backbone collection]}
 */
entities.Collections.UnreadMessages = Backbone.Collection.extend({
    model: entities.Models.UnreadMessage,
});

/**
 * [Dialog model]
 * @type {[Backbone model]}
 */
entities.Models.Dialog = Backbone.Model.extend({
    defaults: {
        id: '',
        type: null,
        room_jid: null,
        room_name: null,
        room_photo: '',
        occupants_ids: [],
        room_updated_date: null,
        last_message_date_sent: null,
        last_message: '',
        last_messages: [],
        unread_count: '',
        unread_messages: [],
        messages: [],
        opened: false,
        joined: false,
        draft: '',
    },

    // add dialog to collection after initialize
    initialize() {
        entities.Collections.dialogs.push(this);

        this.listenTo(this, 'change:unread_count', this.cutMessages);
        this.listenTo(this, 'remove', this.setActiveDialog);
    },

    cutMessages() {
        const messages = this.get('messages');
        const curCount = this.get('unread_count');
        const stack = QMCONFIG.stackMessages;
        const msgCount = messages.length;
        let i;

        if (+curCount === 0) {
            // eslint-disable-next-line no-plusplus, no-loops/no-loops
            for (i = 0; i < (msgCount - stack); i++) {
                messages.pop();
            }
        }
    },

    setActiveDialog() {
        if (this.get('id') === entities.active) {
            entities.active = '';
        }
    },
});

/**
 * [Dialog models collection]
 * @type {[Backbone collection]}
 */
entities.Collections.Dialogs = Backbone.Collection.extend({
    model: entities.Models.Dialog,

    initialize() {
        this.listenTo(this, 'reset', () => {
            entities.active = '';
            $('.chatView').remove();
        });
    },

    readAll(dialogId) {
        const dialog = this.get(dialogId);
        const unreadCount = dialog.get('unread_count');
        const unreadMeassages = dialog.get('unread_messages');
        const unreadMeassagesIds = [];

        if (unreadMeassages.length > 0) {
            // send read status for online messages
            unreadMeassages.each((params) => {
                QB.chat.sendReadStatus(params.toJSON());
                unreadMeassagesIds.push(params.get('messageId'));
            });

            unreadMeassages.reset();
        }
        // read all dialog's messages on REST
        if (+unreadCount > 0) {
            QB.chat.message.update(null, {
                chat_dialog_id: dialogId,
                read: 1,
            }, () => {
                dialog.set('unread_count', '');
            });
        }
    },

    saveDraft() {
        const dialogId = entities.active;
        let dialog;
        let text;

        if (dialogId) {
            dialog = this.get(dialogId);
            text = $(`#textarea_${dialogId}`).text();

            dialog.set('draft', text);
        }
    },

    selectDialog(dialogId) {
        const MessageView = entities.app.views.Message;
        const DialogView = entities.app.views.Dialog;
        const { Cursor } = entities.app.models;
        const dialog = this.get(dialogId);

        if (dialog.get('opened')) {
            DialogView.htmlBuild(dialogId, dialog.get('messages').toJSON());
        } else {
            dialog.set('opened', true);
            DialogView.htmlBuild(dialogId);
        }

        MessageView.clearTheListTyping();
        Cursor.setCursorToEnd($('.l-chat:visible .textarea')[0]);
        // send read status
        this.readAll(dialogId);
    },
});

/**
 * [Chat model]
 * @type {[Backbone model]}
 */
entities.Models.Chat = Backbone.Model.extend({
    defaults: {
        draft: '',
        occupantsIds: '',
        status: '',
        dialog_id: '',
        location: '',
        type: null,
        user_id: null,
        name: '',
        icon: '',
        jid: '',
    },

    initialize() {
        this.buildChatView();
    },

    buildChatView() {
        entities.Views.chat = new entities.Views.Chat({ model: this });
    },
});

/**
 * [Chat view]
 * @type {[Backbone view]}
 */
entities.Views.Chat = Backbone.View.extend({
    tagName: 'div',
    className: 'chatView',
    template: _.template($('#chatTpl').html()),

    initialize() {
        this.render();
    },

    render() {
        const chatTpl = this.template(this.model.toJSON());
        const chatElem = this.$el.html(chatTpl);

        $('#chatWrap').removeClass('is-hidden').append(chatElem);

        return this;
    },
});

/**
 * Events
 */

// select and open dialog
$('.list_contextmenu').on('click', '.contact', function() {
    const dialogId = $(this).parent().data('dialog');

    if (entities.active !== dialogId) {
        entities.Collections.dialogs.selectDialog(dialogId);
    }
});

// read all unread messages
$(window).focus(() => {
    const dialogId = entities.active;

    Helpers.Dialogs.setScrollToNewMessages();

    if (dialogId) {
        entities.Collections.dialogs.readAll(dialogId);
    }
});

// unselect all dialogs
$('.j-home').on('click', () => {
// clear active dialog id
    entities.Collections.dialogs.saveDraft();
    entities.active = '';
});

module.exports = entities;
