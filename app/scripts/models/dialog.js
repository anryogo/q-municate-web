'use strict';

const _ = require('underscore');
const QMCONFIG = require('config');
const Helpers = require('Helpers');
const Entities = require('Entities');

/*
 * Q-municate chat application
 *
 * Dialog Module
 *
 */
function Dialog(app) {
    this.app = app;
}

// noinspection JSAnnotator
Dialog.prototype = {

    download(params, callback) {
        const QBApiCalls = this.app.service;

        QBApiCalls.listDialogs(params, (error, result) => {
            callback(error, result);
        });
    },

    create(params) {
        const { User } = this.app.models;
        const time = Math.floor(Date.now() / 1000);
        // exclude current user from dialog occupants
        // that he doesn't hit to yourself in Contact List
        const dialog = {
            id: params._id, // eslint-disable-line no-underscore-dangle
            type: params.type,
            room_jid: params.xmpp_room_jid || null,
            room_name: params.name || null,
            room_photo: (params.photo && params.photo.replace('http://', 'https://')) || '',
            occupants_ids: _.uniq(_.without(params.occupants_ids, User.contact.id)),
            last_message: params.last_message || ((params.type === 2) ? 'Notification message' : 'Contact request'),
            last_message_date_sent: params.last_message_date_sent || time,
            room_updated_date: Date.parse(params.updated_at)
                || params.room_updated_date
                || time,
            unread_count: params.unread_messages_count || '',
            unread_messages: new Entities.Collections.UnreadMessages(),
            messages: new Entities.Collections.Messages(),
            opened: params.opened || false,
            joined: (params.type === 3),
        };

        new Entities.Models.Dialog(dialog); // eslint-disable-line no-new

        return dialog.id;
    },

    createPrivate(idOrJid, isNew, dialogId) {
        const self = this;
        const QBApiCalls = this.app.service;
        const DialogView = this.app.views.Dialog;
        const { ContactList } = this.app.models;
        const id = (idOrJid.indexOf('@') > -1) ? QB.chat.helpers.getIdFromNode(idOrJid) : idOrJid;

        if (dialogId) {
            QB.chat.dialog.list({ _id: dialogId }, (err, resDialogs) => {
                addContactRequestDialogItem(resDialogs.items[0]);
            });
        } else {
            QBApiCalls.createDialog({
                type: 3,
                occupants_ids: id,
            }, (res) => {
                addContactRequestDialogItem(res, true);
            });
        }

        function addContactRequestDialogItem(objDialog, isClick) {
            const newDialogId = self.create(objDialog);
            const { dialogs } = Entities.Collections;
            const dialog = dialogs.get(newDialogId);

            Helpers.log('Dialog', dialog.toJSON());

            // send notification about subscribe
            if (isClick) {
                QB.chat.send(id, {
                    type: 'chat',
                    body: 'Contact request',
                    extension: {
                        recipient_id: id,
                        date_sent: Math.floor(Date.now() / 1000),
                        dialog_id: dialog.get('id'),
                        save_to_history: 1,
                        notification_type: '4',
                    },
                });
            }

            ContactList.add(dialog.get('occupants_ids'), null, () => {
                DialogView.addDialogItem(dialog, null, isNew);
            });
        }
    },

    createGroup(occupantsNames, params, callback) {
        const QBApiCalls = this.app.service;
        const DialogView = this.app.views.Dialog;
        const { ContactList } = this.app.models;
        const { contacts } = ContactList;
        const self = this;

        QBApiCalls.createDialog(params, (res) => {
            const dialogId = self.create(res);
            const { dialogs } = Entities.Collections;
            const dialog = dialogs.get(dialogId);
            const occupantsIds = dialog.get('occupants_ids');

            Helpers.log('Dialog', dialog.toJSON());

            QB.chat.muc.join(dialog.get('room_jid'), () => {
                dialog.set('joined', true);

                const msgId = QB.chat.helpers.getBsonObjectId();
                const time = Math.floor(Date.now() / 1000);

                QB.chat.addListener({
                    name: 'message',
                    type: 'groupchat',
                    id: msgId,
                }, () => {
                    let id;

                    dialog.set('occupants_ids', occupantsIds);

                    DialogView.addDialogItem(dialog);
                    // send invites for all occupants
                    occupantsIds.forEach((item) => {
                        id = item;
                        QB.chat.sendSystemMessage(contacts[id].user_jid, {
                            body: 'Notification message',
                            extension: {
                                date_sent: time,
                                notification_type: '1',
                                dialog_id: dialog.get('id'),
                                room_name: dialog.get('room_name'),
                                room_updated_date: time,
                                current_occupant_ids: res.occupants_ids.join(),
                                added_occupant_ids: params.occupants_ids,
                                type: 2,
                            },
                        });
                    });

                    callback(dialog);
                });

                // send message about added people for history
                QB.chat.send(dialog.get('room_jid'), {
                    id: msgId,
                    type: 'groupchat',
                    body: 'Notification message',
                    extension: {
                        message_id: msgId,
                        date_sent: time,
                        save_to_history: 1,
                        notification_type: '2',
                        dialog_id: dialog.get('id'),
                        room_updated_date: time,
                        current_occupant_ids: res.occupants_ids.join(),
                        added_occupant_ids: params.occupants_ids,
                        dialog_update_info: 3,
                    },
                });
            });
        });
    },

    restorePrivateDialog(id, callback) {
        const QBApiCalls = this.app.service;
        const DialogView = this.app.views.Dialog;
        const self = this;

        QBApiCalls.createDialog({
            type: 3,
            occupants_ids: id,
        }, (res) => {
            const { dialogs } = Entities.Collections;
            const dialogId = self.create(res);
            const dialog = dialogs.get(dialogId);

            DialogView.addDialogItem(dialog, null, 'new_dialog');

            callback(dialog);
        });
    },

    updateGroup(occupantsNames, params, callback) {
        const QBApiCalls = this.app.service;
        const { ContactList } = this.app.models;
        const { contacts } = ContactList;
        const self = this;

        QBApiCalls.updateDialog(params.dialog_id, {
            push_all: {
                occupants_ids: [params.occupants_ids],
            },
        }, (res) => {
            const dialogId = self.create(res);
            const { dialogs } = Entities.Collections;
            const dialog = dialogs.get(dialogId);
            const msgId = QB.chat.helpers.getBsonObjectId();
            const time = Math.floor(Date.now() / 1000);

            Helpers.log('Dialog', dialog.toJSON());

            QB.chat.addListener({
                name: 'message',
                type: 'groupchat',
                id: msgId,
            }, () => {
                let id;

                callback(dialog);

                // send invites for all new occupants
                params.new_ids.forEach((item) => {
                    id = item;

                    QB.chat.sendSystemMessage(contacts[id].user_jid, {
                        body: 'Notification message',
                        extension: {
                            date_sent: time,
                            notification_type: '1',
                            dialog_id: dialog.get('id'),
                            room_name: dialog.get('room_name'),
                            room_photo: dialog.get('room_photo'),
                            room_updated_date: time,
                            current_occupant_ids: res.occupants_ids.join(),
                            added_occupant_ids: params.new_ids.join(),
                            type: 2,
                        },
                    });
                });
            });

            // send message about added people for history
            QB.chat.send(dialog.get('room_jid'), {
                id: msgId,
                type: 'groupchat',
                body: 'Notification message',
                extension: {
                    date_sent: time,
                    save_to_history: 1,
                    notification_type: '2',
                    current_occupant_ids: res.occupants_ids.join(),
                    added_occupant_ids: params.new_ids.join(),
                    dialog_id: dialog.get('id'),
                    room_updated_date: time,
                    dialog_update_info: 3,
                },
            });
        });
    },

    changeName(dialogId, name) {
        const QBApiCalls = this.app.service;
        const self = this;

        QBApiCalls.updateDialog(dialogId, {
            name,
        }, (res) => {
            const newDialogId = self.create(res);
            const { dialogs } = Entities.Collections;
            const dialog = dialogs.get(newDialogId);

            Helpers.log('Dialog', dialog.toJSON());

            // send notification about updating room
            QB.chat.send(dialog.get('room_jid'), {
                type: 'groupchat',
                body: 'Notification message',
                extension: {
                    date_sent: Math.floor(Date.now() / 1000),
                    save_to_history: 1,
                    notification_type: '2',
                    room_name: name,
                    dialog_id: dialog.get('id'),
                    room_updated_date: dialog.get('room_updated_date'),
                    dialog_update_info: 2,
                },
            });
        });
    },

    changeAvatar(dialogId, objDom, callback) {
        const QBApiCalls = this.app.service;
        const { Attach } = this.app.models;
        const AttachView = this.app.views.Attach;
        const file = objDom[0].files[0] || null;
        const self = this;
        let errMsg;

        if (file) {
            if (file.type.indexOf('image/') === -1) {
                errMsg = QMCONFIG.errors.avatarType;
            } else if (file.name.length > 100) {
                errMsg = QMCONFIG.errors.fileName;
            }

            if (errMsg) {
                Helpers.log('Error', errMsg);
                AttachView.pastErrorMessage(errMsg, objDom, $('.l-chat:visible .l-chat-content .mCSB_container'));
                callback(false);
            } else {
                Attach.crop(file, {
                    w: 1000,
                    h: 1000,
                }, (avatar) => {
                    Attach.upload(avatar, (blob) => {
                        const imgUrl = QB.content.publicUrl(blob.uid);

                        QBApiCalls.updateDialog(dialogId, {
                            photo: imgUrl,
                        }, (res) => {
                            const newDialogId = self.create(res);
                            const { dialogs } = Entities.Collections;
                            const dialog = dialogs.get(newDialogId);

                            Helpers.log('Dialog', dialog.toJSON());

                            // send notification about updating room
                            QB.chat.send(dialog.get('room_jid'), {
                                type: 'groupchat',
                                body: 'Notification message',
                                extension: {
                                    date_sent: Math.floor(Date.now() / 1000),
                                    save_to_history: 1,
                                    notification_type: '2',
                                    room_photo: imgUrl,
                                    dialog_id: dialog.get('id'),
                                    room_updated_date: dialog.get('room_updated_date'),
                                    dialog_update_info: 1,
                                },
                            });

                            callback(imgUrl);
                        });
                    });
                });
            }
        } else {
            callback(false);
        }
    },

    deleteChat(dialog) {
        const QBApiCalls = this.app.service;
        const { dialogs } = Entities.Collections;
        const { User } = this.app.models;
        const dialogId = dialog.get('id');
        const dialogType = dialog.get('type');
        const time = Math.floor(Date.now() / 1000);

        // send notification about leave
        if (dialogType === 2) {
            QB.chat.send(dialog.get('room_jid'), {
                type: 'groupchat',
                body: 'Notification message',
                extension: {
                    date_sent: time,
                    save_to_history: 1,
                    notification_type: '2',
                    current_occupant_ids: dialog.get('occupants_ids').join(),
                    deleted_occupant_ids: User.contact.id,
                    dialog_id: dialogId,
                    room_updated_date: time,
                    dialog_update_info: 3,
                },
            });
        }

        dialogs.remove(dialogId);

        QBApiCalls.deleteDialog(dialogId, (res) => {
            Helpers.log(res);
        });
    },

};

module.exports = Dialog;
