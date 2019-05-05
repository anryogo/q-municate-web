/*
 * Q-municate chat application
 *
 * Attach View Module
 *
 */
define([
    'jquery',
    'config',
    'Helpers',
    'QMHtml',
    'LocationView',
    'underscore',
    'progressbar'
], function (
    $,
    QMCONFIG,
    Helpers,
    QMHtml,
    Location,
    _,
    ProgressBar
) {
    var self;

    var User;
    var Message;
    var Attach;

    function AttachView(app) {
        this.app = app;

        User = this.app.models.User;
        Message = this.app.models.Message;
        Attach = this.app.models.Attach;
        self = this;
    }

    AttachView.prototype = {

        changeInput: function (objDom, recordedAudioFile) {
            var file = recordedAudioFile || objDom[0].files[0];
            var chat = $('.l-chat:visible .l-chat-content .mCSB_container');
            var id = _.uniqueId();
            var fileSize = file.size;
            // eslint-disable-next-line max-len
            var fileSizeCrop = fileSize > (1024 * 1024) ? (fileSize / (1024 * 1024)).toFixed(1) : (fileSize / 1024).toFixed(1);
            var fileSizeUnit = fileSize > (1024 * 1024) ? 'MB' : 'KB';
            var metadata = readMetadata(file);
            var errMsg;
            var html;

            if (file) {
                errMsg = self.validateFile(file);

                if (errMsg) {
                    self.pastErrorMessage(errMsg, objDom, chat);
                } else {
                    html = QMHtml.Attach.attach({
                        fileName: file.name,
                        fileSizeCrop: fileSizeCrop,
                        fileSizeUnit: fileSizeUnit,
                        id: id
                    });
                }

                chat.append(html);

                if (objDom) {
                    objDom.val('');
                }

                fixScroll();

                if (file.type.indexOf('image') > -1) {
                    Attach.crop(file, {
                        w: 1000,
                        h: 1000
                    }, function (blob) {
                        self.createProgressBar(id, fileSizeCrop, metadata, blob);
                    });
                } else {
                    self.createProgressBar(id, fileSizeCrop, metadata, file);
                }
            }
        },

        pastErrorMessage: function (errMsg, objDom, chat) {
            var html = QMHtml.Attach.error({
                errMsg: errMsg
            });

            chat.append(html);

            if (objDom) {
                objDom.val('');
            }

            fixScroll();

            return false;
        },

        createProgressBar: function (id, fileSizeCrop, metadata, file) {
            var progressBar = new ProgressBar('progress_' + id);
            var dialogId = self.app.entities.active;
            var $chatItem = $('.j-chatItem[data-dialog="' + dialogId + '"]');
            var fileSize = file.size || metadata.size;
            var percent = 5;
            var isUpload = false;
            var part;
            var time;

            if (fileSize <= 5 * 1024 * 1024) {
                time = 50;
            } else if (fileSize > 5 * 1024 * 1024) {
                time = 60;
            } else if (fileSize > 6 * 1024 * 1024) {
                time = 70;
            } else if (fileSize > 7 * 1024 * 1024) {
                time = 80;
            } else if (fileSize > 8 * 1024 * 1024) {
                time = 90;
            } else if (fileSize > 9 * 1024 * 1024) {
                time = 100;
            }

            setPercent();

            Attach.upload(file, function (blob) {
                Helpers.log('Blob:', blob);

                if (!blob.size) {
                    blob.size = file.size || metadata.size;
                }

                self.sendMessage($chatItem, blob, metadata);

                isUpload = true;

                if ($('#progress_' + id).length > 0) {
                    setPercent();
                }
            });

            function setPercent() {
                if (isUpload) {
                    progressBar.setPercent(100);
                    part = fileSizeCrop;
                    $('.attach-part_' + id).text(part);

                    setTimeout(function () {
                        $('.attach-part_' + id).parents('article').remove();
                    }, 50);
                } else {
                    progressBar.setPercent(percent);
                    part = (fileSizeCrop * percent / 100).toFixed(1);
                    $('.attach-part_' + id).text(part);
                    percent += 5;

                    if (percent > 95) return;

                    setTimeout(setPercent, time);
                }
            }
        },

        cancel: function (objDom) {
            objDom.parents('article').remove();
        },

        sendMessage: function (chat, blob, metadata, mapCoords) {
            var MessageView = this.app.views.Message;
            var jid = chat.data('jid');
            var id = chat.data('id');
            var dialogId = chat.data('dialog');
            var type = chat.is('.is-group') ? 'groupchat' : 'chat';
            var time = Math.floor(Date.now() / 1000);
            var dialogItem = type === 'groupchat' ? $('.l-list-wrap section:not(#searchList) .dialog-item[data-dialog="' + dialogId + '"]') : $('.l-list-wrap section:not(#searchList) .dialog-item[data-id="' + id + '"]');
            var locationIsActive = $('.j-send_location').hasClass('btn_active');
            var copyDialogItem;
            var lastMessage;
            var message;
            var attach;
            var msg;

            if (mapCoords) {
                attach = {
                    type: 'location',
                    data: mapCoords
                };
            } else {
                attach = Attach.create(blob, metadata);
            }

            msg = {
                type: type,
                body: getAttachmentText(),
                extension: {
                    save_to_history: 1,
                    dialog_id: dialogId,
                    date_sent: time,
                    attachments: [
                        attach
                    ]
                },
                markable: 1
            };

            if (locationIsActive) {
                msg.extension.latitude = localStorage['QM.latitude'];
                msg.extension.longitude = localStorage['QM.longitude'];
            }

            msg.id = QB.chat.send(jid, msg);

            message = Message.create({
                body: msg.body,
                chat_dialog_id: dialogId,
                date_sent: time,
                attachment: attach,
                sender_id: User.contact.id,
                latitude: localStorage['QM.latitude'] || null,
                longitude: localStorage['QM.longitude'] || null,
                _id: msg.id,
                online: true
            });

            Helpers.log(message);
            if (type === 'chat') {
                lastMessage = chat.find('article[data-type="message"]').last();

                message.stack = Message.isStack(true, message, lastMessage);
                MessageView.addItem(message, true, true);
            }

            if (dialogItem.length > 0) {
                copyDialogItem = dialogItem.clone();
                dialogItem.remove();
                $('#recentList ul').prepend(copyDialogItem);
                if (!$('#searchList').is(':visible')) {
                    $('#recentList').removeClass('is-hidden');
                    Helpers.Dialogs.isSectionEmpty($('#recentList ul'));
                }
            }

            function getAttachmentText() {
                var text;

                switch (attach.type) {
                case 'location':
                    text = 'Location';
                    break;

                case 'image':
                    text = 'Image attachment';
                    break;

                case 'audio':
                    text = 'Audio attachment';
                    break;

                case 'video':
                    text = 'Video attachment';
                    break;

                default:
                    text = 'Attachment';
                    break;
                }

                return text;
            }
        },

        validateFile: function (file) {
            var errMsg;
            var maxSize;
            var fullType;
            var type;

            fullType = file.type;

            if (file.type.indexOf('image/') === 0) {
                type = 'image';
            } else if (file.type.indexOf('audio/') === 0) {
                type = 'audio';
            } else if (file.type.indexOf('video/') === 0) {
                type = 'video';
            } else {
                type = 'file';
            }

            if (type === 'video' || type === 'audio') {
                maxSize = QMCONFIG.maxLimitMediaFile * 1024 * 1024;
            } else {
                maxSize = QMCONFIG.maxLimitFile * 1024 * 1024;
            }

            if (file.name.length > 100) {
                errMsg = QMCONFIG.errors.fileName;
            } else if (file.size > maxSize) {
                if (type === 'video') {
                    errMsg = QMCONFIG.errors.videoSize;
                } else {
                    errMsg = QMCONFIG.errors.fileSize;
                }
            }

            if (type === 'video' && fullType !== 'video/mp4') {
                errMsg = 'This video format is not supported, only *.mp4';
            } else if (type === 'audio' && fullType !== 'audio/mp3') {
                if (fullType !== 'audio/mpeg') {
                    errMsg = 'This audio format is not supported, only *.mp3';
                }
            } else if (type === 'file') {
                errMsg = 'This file format isn\'t supported';
            }

            return errMsg;
        }

    };

    /* Private
    ---------------------------------------------------------------------- */
    function fixScroll() {
        $('.l-chat:visible .j-scrollbar_message').mCustomScrollbar('scrollTo', 'bottom');
    }

    function readMetadata(file) {
        var WINDOW_URL = window.URL || window.webkitURL;
        var metadata = { size: file.size };
        var image;
        var audio;
        var video;
        var type;

        if (file.type.indexOf('image/') === 0) {
            type = 'image';
        } else if (file.type.indexOf('audio/') === 0) {
            type = 'audio';
        } else if (file.type.indexOf('video/') === 0) {
            type = 'video';
        } else {
            type = 'file';
        }

        switch (type) {
        case 'image':
            image = new Image();

            image.src = WINDOW_URL.createObjectURL(file);
            image.onload = function () {
                metadata.width = this.width;
                metadata.height = this.height;
            };
            break;

        case 'audio':
            audio = new Audio();

            audio.src = WINDOW_URL.createObjectURL(file);
            audio.onloadedmetadata = function () {
                metadata.duration = Math.floor(this.duration);
            };
            break;

        case 'video':
            video = document.createElement('video');

            video.src = WINDOW_URL.createObjectURL(file);
            video.onloadedmetadata = function () {
                metadata.width = this.videoWidth;
                metadata.height = this.videoHeight;
                metadata.duration = Math.floor(this.duration);
            };
            break;

        default:
            break;
        }

        return metadata;
    }

    return AttachView;
});
