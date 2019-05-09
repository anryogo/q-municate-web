/**
 * Helper Module
 */
define([
    'jquery',
    'underscore',
    'config',
    'QBNotification'
], function(
    $,
    _,
    QMCONFIG,
    QBNotification
) {
    var Helpers = {};

    Helpers.Notifications = {

        show: function(title, options) {
            var notify;

            // show notification if all parameters are is
            if (title && options) {
                notify = new QBNotification(title, options);
                notify.show();
            }
        },

        getTitle: function(message, params) {
            var contacts = params.contacts;
            var roomName = params.roomName;
            var contact = contacts[message.sender_id];
            var title;

            title = roomName || contact.full_name;

            return title;
        },

        getOptions: function(message, params) {
            var myUser = params.user;
            var contacts = params.contacts;
            var roomPhoto = params.roomPhoto;
            var contact = contacts[message.sender_id];
            var chatType = message.type;
            var photo = (chatType === 'chat') ? (contact.avatar_url || QMCONFIG.defAvatar.url_png) : (roomPhoto || QMCONFIG.defAvatar.group_url_png);
            var type = message.notification_type || (message.callState && (parseInt(message.callState, 10) + 7).toString()) || 'message';
            var selectDialog = $('.dialog-item[data-dialog="' + message.dialog_id + '"] .contact');
            var occupantsIds;
            var occupantsNames = '';
            var options;
            var text;

            // hot fix (local notifications can't shows image.svg)
            if (photo === 'images/ava-single.svg') {
                photo = QMCONFIG.defAvatar.url_png;
            }

            /**
             * [to prepare the text in the notification]
             * @param  {[type]} type [system notification type]
             * @return {[text]}      [notification description text]
             * 1 - groupchat created
             * 2 - about any changes in groupchat
             * 3 - not use yet
             * 4 - incomming contact request
             * 5 - contact request accepted
             * 6 - contact request rejected
             * 7 - about deleting from contact list
             * 8 - incomming call
             * 9 - about missed call
             * 10 - сamera and/or microphone wasn't found
             * 11 - incoming call
             * 12 - call accepted
             * default - message
             */
            switch (type) {
            // system notifications
            case '1':
                occupantsIds = _.without(message.current_occupant_ids.split(',').map(Number), contact.id);
                occupantsNames = Helpers.Messages.getOccupantsNames(occupantsIds, myUser, contacts);
                text = contact.full_name + ' has added ' + occupantsNames + ' to the group chat';
                break;

                // groupchat updated
            case '2':
                text = 'Notification message';
                break;

                // contacts
            case '4':
                text = contact.full_name + ' has sent a request to you';
                break;

            case '5':
                text = 'Your request has been accepted by ' + contact.full_name;
                break;

            case '6':
                text = 'Your request has been rejected by ' + contact.full_name;
                break;

            case '7':
                text = 'You have been deleted from the contact list by ' + contact.full_name;
                break;

                // calls
            case '8':
                if (message.caller === myUser.contact.id) {
                    text = 'Call to ' + contacts[message.callee].full_name + ', duration ' + Helpers.getDuration(message.callDuration);
                } else {
                    text = 'Call from ' + contacts[message.caller].full_name + ', duration ' + Helpers.getDuration(message.callDuration);
                }
                break;

            case '9':
                if (message.caller === myUser.contact.id) {
                    text = 'Call to ' + contacts[message.callee].full_name + ', no answer';
                } else {
                    text = 'Missed call from ' + contacts[message.caller].full_name;
                }
                break;

            case '10':
                if (message.caller === myUser.contact.id) {
                    text = contacts[message.callee].full_name + ' doesn\'t have camera and/or microphone.';
                } else {
                    text = 'Camera and/or microphone wasn\'t found.';
                }
                break;

            case '11':
                text = 'Incomming ' + message.callType + ' Call from ' + contact.full_name;
                break;

            case '12':
                text = 'The ' + message.callType + ' Call accepted by ' + contact.full_name;
                break;

                // messages
            default:
                if (chatType === 'groupchat') {
                    text = contact.full_name + ': ' + message.body;
                } else {
                    text = message.body;
                }

                break;
            }

            if (text) {
                text = text.replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&amp;/gi, '&');
                options = {
                    body: text,
                    icon: photo,
                    tag: message.dialog_id,
                    onClick: function() {
                        window.focus();
                        selectDialog.click();
                    },
                    timeout: QMCONFIG.notification.timeout,
                    closeOnClick: true
                };
            }

            return options;
        }
    };

    Helpers.Messages = {
        getOccupantsNames: function(occupantsIds, myUser, contacts) {
            var occupantsNames = '';
            var myContact = myUser.contact;
            var len = occupantsIds.length;
            var user;

            occupantsIds.forEach(function(item, index) {
                user = contacts[item] && contacts[item].full_name;
                if (user) {
                    occupantsNames = (index + 1) === len ? occupantsNames.concat(user) : occupantsNames.concat(user).concat(', ');
                } else if (item === myContact.id) {
                    occupantsNames = (index + 1) === len ? occupantsNames.concat(myContact.full_name) : occupantsNames.concat(myContact.full_name).concat(', ');
                }
            });

            return occupantsNames;
        },

        parser: function(str) {
            var url;
            var urlText;
            var URL_REGEXP = /\b((?:https?:\/\/|www\d{0,3}\.|[\d-.a-z]+\.[a-z]{2,4}\/)(?:[^\s()<>]+|\(([^\s()<>]+|(\([^\s()<>]+\)))*\))+(?:\(([^\s()<>]+|(\([^\s()<>]+\)))*\)|[^\s!"'(),.:;<>?[\]`{}«»‘’“”]))/gi;

            /* eslint-disable no-param-reassign */
            str = escapeHTML(str);

            // parser of paragraphs
            str = str.replace(/\n/g, '<br>');

            // parser of links
            str = str.replace(URL_REGEXP, function(match) {
                url = (/^[a-z]+:/i).test(match) ? match : 'http://' + match;
                urlText = match;
                return '<a href="' + escapeHTML(url) + '" target="_blank">' + escapeHTML(urlText) + '</a>';
            });
            /* eslint-enable no-param-reassign */

            return str;

            function escapeHTML(s) {
                return s.replace(/</g, '&lt;').replace(/>/g, '&gt;');
            }
        }
    };

    Helpers.Dialogs = {
        moveDialogToTop: function(dialogId) {
            var dialogItem = $('.l-list-wrap section:not(#searchList) .dialog-item[data-dialog="' + dialogId + '"]');
            var copyDialogItem;

            if (dialogItem.length > 0) {
                copyDialogItem = dialogItem.clone();
                dialogItem.remove();
                $('.j-recentList').prepend(copyDialogItem);
                if (!$('#searchList').is(':visible')) {
                    $('#recentList').removeClass('is-hidden');
                    this.isSectionEmpty($('#recentList ul.j-list'));
                }
            }
        },

        isSectionEmpty: function(list) {
            if (list.contents().length === 0) {
                list.parent().addClass('is-hidden');
            }

            if ($('#historyList ul.j-list').contents().length === 0) {
                $('#historyList ul.j-list').parent().addClass('is-hidden');
            }

            if ($('#requestsList').is('.is-hidden')
                && $('#recentList').is('.is-hidden')
                && $('#historyList').is('.is-hidden')) {
                $('#emptyList').removeClass('is-hidden');
            }
        },

        setScrollToNewMessages: function() {
            var $chat = $('.j-chatItem .j-scrollbar_message');

            if ($('.j-newMessages').length) {
                $chat.mCustomScrollbar('scrollTo', '.j-newMessages');
            }
        }
    };

    // smart console
    /* eslint-disable no-console */
    Helpers.log = function() {
        var args = Array.prototype.slice.call(arguments);
        var i;

        if (QMCONFIG.debug) {
            if (args.length <= 1) {
                console.group('[Q-MUNICATE debug mode]:');
                console.log(args[0]);
                console.groupEnd();
            } else {
                console.group('[Q-MUNICATE debug mode]:');

                // eslint-disable-next-line no-plusplus, no-loops/no-loops
                for (i = 0; i < args.length; i++) {
                    if ((typeof args[i] === 'string') && (typeof args[i + 1] !== 'string')) {
                        console.log(args[i], args[i + 1]);
                        i += 1;
                    } else {
                        console.log(args[i]);
                    }
                }

                console.groupEnd();
            }
        }
    };
    /* eslint-enable no-console */

    Helpers.isBeginOfChat = function() {
        var bottom = true;
        var viewPort;
        var msgList;
        var viewPortBottom;
        var msgListPosition;
        var msgListHeight;
        var msgListBottom;

        if (!document.querySelector('.j-chatItem')) {
            return null;
        }

        viewPort = document.querySelector('.j-scrollbar_message');
        msgList = document.querySelector('.j-scrollbar_message .mCSB_container');
        viewPortBottom = viewPort.clientHeight + 350;
        msgListPosition = msgList.offsetTop;
        msgListHeight = msgList.clientHeight;
        msgListBottom = msgListPosition + msgListHeight;

        if (msgListPosition < 0) {
            bottom = viewPortBottom > msgListBottom;
        }

        return bottom;
    };

    Helpers.getDuration = function(seconds, duration) {
        if (duration) {
            return Date.parse('Thu, 01 Jan 1970 ' + duration + ' GMT') / 1000;
        }
        return new Date(seconds * 1000).toUTCString().split(/ /)[4];
    };

    Helpers.getTime = function(time, isDate) {
        var messageDate = new Date(time * 1000);
        var startOfCurrentDay = new Date();

        startOfCurrentDay.setHours(0, 0, 0, 0);

        if (messageDate > startOfCurrentDay) {
            return messageDate.getHours() + ':' + (messageDate.getMinutes().toString().length === 1 ? '0' + messageDate.getMinutes() : messageDate.getMinutes());
        } if ((messageDate.getFullYear() === startOfCurrentDay.getFullYear()) && !isDate) {
            return $.timeago(messageDate);
        }
        return messageDate.getDate() + '/' + (messageDate.getMonth() + 1) + '/' + messageDate.getFullYear();
    };

    Helpers.scaleAvatar = function($pic) {
        var $chat = $pic.parents('.l-chat');
        var name = $pic.data('name');
        var url = $pic.css('background-image').replace(/.*\s?url\(["']?/, '')
            .replace(/["']?\).*/, ''); // take URL from css background source
        var $popup = $('.j-popupAvatar');
        var dialogId;

        if ($chat.is('.is-group')) {
            dialogId = $chat.data('dialog');
            $popup.find('.j-changePic').removeClass('is-hidden')
                .data('dialog', dialogId);
        } else {
            $popup.find('.j-changePic').addClass('is-hidden');
        }

        $popup.find('.j-avatarPic').attr('src', url);
        $popup.find('.j-avatarName').text(name);
        $popup.add('.popups').addClass('is-overlay');
    };

    Helpers.getOpenGraphInfo = function(params, callback) {
        var ajaxCall = {
            url: 'https://ogs.quickblox.com/?url=' + params.url + '&token=' + params.token,
            error: function(jqHXR, status, error) {
                callback(error, null);
            },
            success: function(data) {
                callback(null, data);
            }
        };

        $.ajax(ajaxCall);
    };

    Helpers.isValidUrl = function(url) {
        var validator = /^(?:([a-z]+):(?:([a-z]*):)?\/\/)?(?:([^:@]*)(?::([^:@]*))?@)?((?:[\w-]+\.)+[a-z]{2,}|localhost|(?:(?:[01]?\d\d?|2[0-4]\d|25[0-5])\.){3}(?:[01]?\d\d?|2[0-4]\d|25[0-5]))(?::(\d+))?(?:([^#:?]+))?(?:\?([^#]+))?(?:#(\S+))?$/i;
        return validator.test(url);
    };

    Helpers.isImageUrl = function(url) {
        return /.svg|.png|.jpg|.jpeg|.gif/i.test(url);
    };

    Helpers.pauseAllMedia = function(target) {
        document.querySelectorAll('.j-audioPlayer, .j-videoPlayer').forEach(function(element) {
            if (element !== target) {
                element.pause();
                if (target) {
                    element.currentTime = 0;
                }
            }
        });
    };

    Helpers.isIE11orEdge = function() {
        return (/rv:11.0/i.test(navigator.userAgent) || /edge\/\d./i.test(navigator.userAgent));
    };

    return Helpers;
});
