'use strict';

const QMCONFIG = require('config');
const Entities = require('../entities');

/*
 * Q-municate chat application
 *
 * Message Module
 *
 */
let self;

function Message(app) {
    this.app = app;
    this.skip = undefined;
    self = this;
}

Message.prototype = {

    download(dialogId, callback, count, isAjaxDownloading) {
        const QBApiCalls = this.app.service;
        const DialogView = this.app.views.Dialog;
        let limitCount = QMCONFIG.stackMessages;
        let skipCount;

        if (self.skip === count) {
            return;
        }

        if (isAjaxDownloading) {
            DialogView.createDataSpinner(null, null, true);
            skipCount = count;
        } else {
            limitCount = count;
        }

        QBApiCalls.listMessages({
            chat_dialog_id: dialogId,
            sort_desc: 'date_sent',
            limit: limitCount,
            skip: skipCount || 0,
        }, (messages, error) => {
            if (error) {
                callback(null, error);
                return;
            }

            if (isAjaxDownloading) {
                self.skip = skipCount;
                DialogView.removeDataSpinner();
            }

            callback(messages);
        });
    },

    create(params, ajax) {
        /* eslint-disable max-len */
        const message = {
            // eslint-disable-next-line no-underscore-dangle
            id: (params.extension && params.extension.message_id) || params._id || params.id || null,
            body: params.body || params.message || '',
            type: params.type || '',
            date_sent: (params.extension && params.extension.date_sent) || params.date_sent,
            read_ids: params.read_ids || [],
            delivered_ids: params.delivered_ids || [],
            notification_type: (params.extension && params.extension.notification_type) || params.notification_type || null,
            dialog_id: (params.extension && params.extension.dialog_id) || params.chat_dialog_id,
            read: params.read || false,
            attachment: (params.extension && params.extension.attachments && params.extension.attachments[0])
                || (params.attachments && params.attachments[0]) || params.attachment || null,
            sender_id: params.sender_id || params.userId || null,
            recipient_id: params.recipient_id || (params.extension && params.extension.recipient_id) || null,
            current_occupant_ids: (params.extension && params.extension.current_occupant_ids) || params.current_occupant_ids || null,
            added_occupant_ids: (params.extension && params.extension.added_occupant_ids) || params.added_occupant_ids || null,
            deleted_occupant_ids: (params.extension && params.extension.deleted_occupant_ids) || params.deleted_occupant_ids || null,
            room_name: (params.extension && params.extension.room_name) || params.room_name || null,
            room_photo: (params.extension && params.extension.room_photo && params.extension.room_photo.replace('http://', 'https://'))
                || (params.room_photo && params.room_photo.replace('http://', 'https://')) || null,
            room_updated_date: (params.extension && params.extension.room_updated_date) || params.room_updated_date || null,
            dialog_update_info: (params.extension && params.extension.dialog_update_info) || params.dialog_update_info || null,
            callType: (params.extension && params.extension.callType) || params.callType || null,
            callState: (params.extension && params.extension.callState) || params.callState || null,
            caller: parseInt((params.extension && params.extension.caller), 10) || parseInt(params.caller, 10) || null,
            callee: parseInt((params.extension && params.extension.callee), 10) || parseInt(params.callee, 10) || null,
            callDuration: (params.extension && params.extension.callDuration) || params.callDuration || null,
            sessionID: (params.extension && params.extension.sessionID) || params.sessionID || null,
            latitude: (params.extension && params.extension.latitude) || params.latitude || null,
            longitude: (params.extension && params.extension.longitude) || params.longitude || null,
            stack: false,
            online: params.online || false,
            status: ((params.extension && params.extension.notification_type) || params.notification_type) ? '' : 'Not delivered yet',
        };
        /* eslint-denable max-len */

        if (message.attachment && message.attachment.size) {
            message.attachment.size = parseInt(message.attachment.size, 10);
        }

        Object.keys(message).forEach((prop) => {
            if (message[prop] === null) {
                delete message[prop];
            }
        });

        if (!ajax || message.notification_type) {
            new Entities.Models.Message(message); // eslint-disable-line no-new
        }

        return message;
    },

    isStack(online, curMsg, prevMsg) {
        let sameUser; let sameTime;
        let stack = false;
        let lastMessageSender;
        let lastMessageDateSent;

        if (prevMsg) {
            if (online) {
                lastMessageSender = +prevMsg.attr('data-id');
                lastMessageDateSent = +prevMsg.find('.message-time').attr('data-time');

                sameUser = (curMsg.sender_id === lastMessageSender) ? (!!prevMsg.attr('id')) : false;
                sameTime = (Math.floor(curMsg.date_sent / 60) === Math.floor(lastMessageDateSent / 60));
            } else {
                if (prevMsg.notification_type) {
                    sameUser = false;
                } else {
                    sameUser = (curMsg.sender_id === prevMsg.sender_id);
                }
                sameTime = (Math.floor(curMsg.date_sent / 60) === Math.floor(prevMsg.date_sent / 60));
            }
            stack = !!((sameTime && sameUser));
        }

        return stack;
    },

};

module.exports = Message;
