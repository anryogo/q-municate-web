/*
 * Q-municate chat application
 *
 * VideoChat View Module
 *
 */
define([
    'jquery',
    'Entities',
    'config',
    'Helpers',
    'QBNotification',
    'QMHtml'
], function (
    $,
    Entities,
    QMCONFIG,
    Helpers,
    QBNotification,
    QMHtml
) {
    var self;
    var User;
    var Settings;
    var VideoChat;
    var VoiceMessage;
    var ContactList;
    var SyncTabs;
    var callTimer;
    var sendAutoReject;
    var curSession = {};
    var isFirefox = navigator.userAgent.toLowerCase().indexOf('firefox') > -1;

    function VideoChatView(app) {
        this.app = app;
        self = this;
        Settings = this.app.models.Settings;
        SyncTabs = this.app.models.SyncTabs;
        User = this.app.models.User;
        ContactList = this.app.models.ContactList;
        VideoChat = this.app.models.VideoChat;
        VoiceMessage = this.app.models.VoiceMessage;
    }

    VideoChatView.prototype.cancelCurrentCalls = function () {
        var $mediacall = $('.mediacall');

        if ($mediacall.length > 0) {
            $mediacall.find('.btn_hangup').click();
        }
    };

    VideoChatView.prototype.clearChat = function () {
        var $chatView = $('.chatView');

        if ($chatView.length > 1) {
            $chatView.first().remove();
        }
    };

    VideoChatView.prototype.init = function () {
        var DialogView = this.app.views.Dialog;
        var Dialog = this.app.models.Dialog;

        $('body').on('click', '.videoCall, .audioCall', function () {
            var $this = $(this);
            var className;
            var userId;
            var $dialogItem;
            var dialogId;

            if (QB.webrtc) {
                $this = $(this);
                className = $this.attr('class');
                userId = $this.data('id');
                $dialogItem = $('.j-dialogItem[data-id="' + userId + '"]');

                if ($dialogItem.length) {
                    dialogId = $dialogItem.data('dialog');
                    openChatAndStartCall(dialogId);
                } else {
                    Dialog.restorePrivateDialog(userId, function (dialog) {
                        dialogId = dialog.get('id');
                        openChatAndStartCall(dialogId);
                    });
                }
            } else {
                QMHtml.VideoChat.noWebRTC();
            }

            // remove contextmenus after start call
            $('.is-contextmenu').removeClass('is-contextmenu');
            $('.j-listActionsContacts').remove();

            function openChatAndStartCall(chatId) {
                DialogView.htmlBuild(chatId);
                self.cancelCurrentCalls();
                self.startCall(className, chatId);
                curSession = self.app.models.VideoChat.session;
            }

            return false;
        });

        $('#popupIncoming').on('click', '.btn_decline', function () {
            var $self = $(this);
            var $incomingCall = $self.parents('.incoming-call');
            var opponentId = $self.data('id');
            var dialogId = $self.data('dialog');
            var callType = $self.data('calltype');
            var audioSignal = document.getElementById('ringtoneSignal');

            curSession.reject({});

            VideoChat.sendMessage(opponentId, '2', null, dialogId, callType);

            $incomingCall.remove();

            if ($('#popupIncoming .mCSB_container').children().length === 0) {
                closePopup();
                if (Settings.get('sounds_notify')) {
                    audioSignal.pause();
                }
            }

            return false;
        });

        $('#popupIncoming').on('click', '.btn_accept', function () {
            var $self = $(this);
            var id;
            var $dialogItem;
            var dialogId;
            var sessionId;
            var callType;
            var audioSignal;
            var params;
            var $chat;

            self.cancelCurrentCalls();

            clearTimeout(sendAutoReject);
            sendAutoReject = undefined;

            id = $self.data('id');
            $dialogItem = $('.dialog-item[data-id="' + id + '"]');

            DialogView.htmlBuild($dialogItem);

            dialogId = $self.data('dialog');
            sessionId = $self.data('session');
            callType = $self.data('calltype');
            audioSignal = $('#ringtoneSignal')[0];
            params = self.build(dialogId);
            $chat = $('.l-chat[data-dialog="' + dialogId + '"]');

            $self.parents('.incoming-call').remove();
            $('#popupIncoming .mCSB_container').children().each(function () {
                $self.find('.btn_decline').click();
            });

            closePopup();

            if (Settings.get('sounds_notify')) {
                audioSignal.pause();
            }

            params.isCallee = true;

            VideoChat.getUserMedia(params, callType, function (err) {
                if (err) {
                    $chat.find('.mediacall .btn_hangup').data('errorMessage', 1);
                    $chat.find('.mediacall .btn_hangup').click();
                    fixScroll();
                    return;
                }

                VoiceMessage.resetRecord();
                VoiceMessage.blockRecorder('during a call');

                if (callType === 'audio') {
                    self.type = 'audio';
                    $('.btn_camera_off').click();
                } else {
                    self.type = 'video';
                    self.unmute('video');
                }

                self.sessionID = sessionId;
                addCallTypeIcon(id, callType);
            });

            return false;
        });

        $('body').on('click', '.btn_hangup', function () {
            var $self = $(this);
            var $chat;
            var opponentId;
            var dialogId;
            var callType;
            var duration;
            var callingSignal;
            var endCallSignal;
            var isErrorMessage;

            self.clearChat();

            $chat = $self.parents('.l-chat');
            opponentId = $self.data('id');
            dialogId = $self.data('dialog');
            callType = curSession.callType === 1 ? 'video' : 'audio';
            duration = $self.parents('.mediacall').find('.mediacall-info-duration').text();
            callingSignal = $('#callingSignal')[0];
            endCallSignal = $('#endCallSignal')[0];
            isErrorMessage = $self.data('errorMessage');

            if (VideoChat.caller) {
                if (!isErrorMessage && duration !== 'connect...') {
                    VideoChat.sendMessage(opponentId, '1', duration, dialogId, null, null, self.sessionID);
                } else {
                    VideoChat.sendMessage(opponentId, '1', null, dialogId, callType);
                    $self.removeAttr('data-errorMessage');
                }
            }

            if (Settings.get('sounds_notify') && SyncTabs.get()) {
                callingSignal.pause();
                endCallSignal.play();
            }

            clearTimeout(callTimer);

            curSession.stop({});

            self.type = null;
            $chat.find('.mediacall').remove();
            $chat.find('.l-chat-header').show();
            $chat.find('.l-chat-content').css({
                height: 'calc(100% - 140px)'
            });

            addCallTypeIcon(opponentId, null);

            return false;
        });

        $('body').on('click', '.btn_camera_off, .btn_mic_off', switchOffDevice);

        // full-screen-mode
        $('body').on('click', '.btn_full-mode', function () {
            var mediaScreen = document.getElementsByClassName('mediacall')[0];
            var isFullScreen = false;

            if (mediaScreen.requestFullscreen) {
                if (document.fullScreenElement) {
                    document.cancelFullScreen();
                    isFullScreen = false;
                } else {
                    mediaScreen.requestFullscreen();
                    isFullScreen = true;
                }
            } else if (mediaScreen.mozRequestFullScreen) {
                if (document.mozFullScreenElement) {
                    document.mozCancelFullScreen();
                    isFullScreen = false;
                } else {
                    mediaScreen.mozRequestFullScreen();
                    isFullScreen = true;
                }
            } else if (mediaScreen.webkitRequestFullscreen) {
                if (document.webkitFullscreenElement) {
                    document.webkitCancelFullScreen();
                    isFullScreen = false;
                } else {
                    mediaScreen.webkitRequestFullscreen();
                    isFullScreen = true;
                }
            }

            if (isFullScreen) {
                $('#fullModeOn').hide();
                $('#fullModeOff').show();
            } else {
                $('#fullModeOn').show();
                $('#fullModeOff').hide();
            }

            return false;
        });

        $(window).on('resize', function () {
            setScreenStyle();
        });
    };

    VideoChatView.prototype.onCall = function (session, extension) {
        var audioSignal;
        var $incomings;
        var id;
        var contact;
        var callType;
        var userName;
        var userAvatar;
        var $dialogItem;
        var dialogId;
        var autoReject;
        var htmlTpl;
        var tplParams;

        if (User.contact.id === session.initiatorID) {
            return;
        }

        if ($('div.popups.is-overlay').length) {
            $('.is-overlay:not(.chat-occupants-wrap)').removeClass('is-overlay');
        }

        audioSignal = document.getElementById('ringtoneSignal');
        $incomings = $('#popupIncoming');
        id = session.initiatorID;
        contact = ContactList.contacts[id];
        callType = (session.callType === 1 ? 'video' : 'audio') || extension.call_type;
        userName = contact.full_name || extension.full_name;
        userAvatar = contact.avatar_url || extension.avatar;
        $dialogItem = $('.j-dialogItem[data-id="' + id + '"]');
        dialogId = $dialogItem.length ? $dialogItem.data('dialog') : null;
        autoReject = QMCONFIG.QBconf.webrtc.answerTimeInterval * 1000;

        if (!dialogId && ContactList.roster[id]) {
            self.app.models.Dialog.restorePrivateDialog(id, function (dialog) {
                dialogId = dialog.get('id');
                incomingCall();
            });
        } else {
            incomingCall();
        }

        function incomingCall() {
            tplParams = {
                userAvatar: userAvatar,
                callTypeUС: capitaliseFirstLetter(callType),
                callType: callType,
                userName: userName,
                dialogId: dialogId,
                sessionId: session.ID,
                userId: id
            };

            htmlTpl = QMHtml.VideoChat.onCallTpl(tplParams);

            $incomings.find('.mCSB_container').prepend(htmlTpl);
            openPopup($incomings);

            Helpers.pauseAllMedia();

            if (Settings.get('sounds_notify') && SyncTabs.get()) {
                audioSignal.play();
            }

            VideoChat.session = session;
            curSession = VideoChat.session;

            createAndShowNotification({
                id: id,
                dialogId: dialogId,
                callState: '4',
                callType: callType
            });

            sendAutoReject = setTimeout(function () {
                $('.btn_decline').click();
            }, autoReject);
        }
    };

    VideoChatView.prototype.onIgnored = function (state, session, id, extension) {
        var dialogId;
        var callType;

        if ((state === 'onAccept') && (User.contact.id === id)) {
            stopIncomingCall(session.initiatorID);
        }
        if ((state === 'onStop') && (User.contact.id === id)) {
            closeStreamScreen(id);
        }
        // send message to caller that user is busy
        if ((state === 'onCall') && (User.contact.id !== id)) {
            dialogId = $('li.list-item.dialog-item[data-id="' + id + '"]').data('dialog');
            callType = (extension.callType === '1' ? 'video' : 'audio') || extension.call_type;

            VideoChat.sendMessage(id, '2', null, dialogId, callType);
        }
    };

    VideoChatView.prototype.onAccept = function (session, id) {
        var audioSignal = document.getElementById('callingSignal');
        var dialogId = $('li.list-item.dialog-item[data-id="' + id + '"]').data('dialog');
        var callType = self.type;

        if (Settings.get('sounds_notify')) {
            audioSignal.pause();
        }

        self.sessionID = session.ID;

        addCallTypeIcon(id, callType);

        createAndShowNotification({
            id: id,
            dialogId: dialogId,
            callState: '5',
            callType: callType
        });
    };

    VideoChatView.prototype.onRemoteStream = function (session, id, stream) {
        var video = document.getElementById('remoteStream');

        curSession.attachMediaStream('remoteStream', stream);
        $('.mediacall .btn_full-mode').prop('disabled', false);

        if (self.type === 'video') {
            video.addEventListener('timeupdate', function () {
                var duration = getTimer(Math.floor(video.currentTime));
                $('.mediacall-info-duration').text(duration);
            });

            $('#remoteUser').addClass('is-hidden');
            $('#remoteStream').removeClass('is-hidden');
        } else {
            setTimeout(function () {
                setDuration();

                $('#remoteStream').addClass('is-hidden');
                $('#remoteUser').removeClass('is-hidden');
            }, 2700);
        }
    };

    VideoChatView.prototype.onReject = function (session, id) {
        var dialogId = $('li.list-item.dialog-item[data-id="' + id + '"]').data('dialog');
        var $chat = $('.l-chat[data-dialog="' + dialogId + '"]');
        var isCurrentUser = (User.contact.id === id);

        if (Settings.get('sounds_notify')) {
            document.getElementById('callingSignal').pause();
        }

        if (isCurrentUser) {
            stopIncomingCall(session.initiatorID);
        }

        curSession = {};
        VideoChat.session = null;
        VideoChat.caller = null;
        VideoChat.callee = null;
        self.type = null;

        $chat.parent('.chatView').removeClass('j-mediacall');
        $chat.find('.mediacall-info-duration').text('');
        $chat.find('.mediacall').remove();
        $chat.find('.l-chat-header').show();
        $chat.find('.l-chat-content').css({
            height: 'calc(100% - 140px)'
        });

        addCallTypeIcon(id, null);
    };

    VideoChatView.prototype.onStop = function (session, id) {
        closeStreamScreen(id);
    };

    VideoChatView.prototype.onUpdateCall = function (session, id, extension) {
        var dialogId = $('li.list-item.dialog-item[data-id="' + id + '"]').data('dialog');
        var $chat = $('.l-chat[data-dialog="' + dialogId + '"]');
        var $selector = $(window.document.body);

        if ($chat[0] && ($chat.find('.mediacall')[0])) {
            if (extension.mute === 'video') {
                $selector.find('#remoteStream').addClass('is-hidden');
                $selector.find('#remoteUser').removeClass('is-hidden');
            }
            if (extension.unmute === 'video') {
                $selector.find('#remoteStream').removeClass('is-hidden');
                $selector.find('#remoteUser').addClass('is-hidden');
            }
        }
    };

    // eslint-disable-next-line max-len
    VideoChatView.prototype.onSessionConnectionStateChangedListener = function (session, userID, connectionState) {
    // connectionState === 3 (failed) - will close connection (for firefox browser)
        if (isFirefox && (connectionState === 3)) {
            curSession.closeConnection(userID);
            $('.btn_hangup').click();
        }
    };

    VideoChatView.prototype.onSessionCloseListener = function () {
        var opponentId = User.contact.id === VideoChat.callee ? VideoChat.caller : VideoChat.callee;

        closeStreamScreen(opponentId);
    };

    VideoChatView.prototype.onUserNotAnswerListener = function () {
        $('.btn_hangup').click();
    };

    VideoChatView.prototype.startCall = function (className, dialogId) {
        var audioSignal = document.getElementById('callingSignal');
        var params = self.build(dialogId);
        var $chat = $('.l-chat:visible');
        var callType = className.match(/audioCall/) ? 'audio' : 'video';
        var QBApiCalls = this.app.service;
        var calleeId = params.opponentId;
        var fullName = User.contact.full_name;
        var id = $chat.data('id');

        VideoChat.getUserMedia(params, callType, function (err) {
            fixScroll();
            if (err) {
                $chat.find('.mediacall .btn_hangup').click();
                QMHtml.VideoChat.showError();
                return;
            }
            QBApiCalls.sendPushNotification(calleeId, fullName);


            VoiceMessage.resetRecord();
            VoiceMessage.blockRecorder('during a call');

            if (Settings.get('sounds_notify')) {
                audioSignal.play();
            }

            if (callType === 'audio') {
                self.type = 'audio';
                $('.btn_camera_off').click();
            } else {
                self.type = 'video';
                self.unmute('video');
            }

            addCallTypeIcon(id, callType);
            $('.chatView').addClass('j-mediacall');
        });
    };

    VideoChatView.prototype.build = function (id) {
        var $chat = id ? $('.j-chatItem[data-dialog="' + id + '"]') : $('.j-chatItem:visible');
        var userId = $chat.data('id');
        var dialogId = $chat.data('dialog');
        var contact = ContactList.contacts[userId];
        var htmlTpl;
        var tplParams;

        tplParams = {
            userAvatar: User.contact.avatar_url,
            contactAvatar: contact.avatar_url,
            contactName: contact.full_name,
            dialogId: dialogId,
            userId: userId
        };

        htmlTpl = QMHtml.VideoChat.buildTpl(tplParams);

        $chat.parent('.chatView').addClass('j-mediacall');
        $chat.prepend(htmlTpl);
        $chat.find('.l-chat-header').hide();
        $chat.find('.l-chat-content').css({
            height: 'calc(50% - 90px)'
        });

        setScreenStyle();

        return {
            opponentId: userId,
            dialogId: dialogId
        };
    };

    VideoChatView.prototype.mute = function (callType) {
        curSession.mute(callType);
        if (callType === 'video') {
            $('#localStream').addClass('is-hidden');
            $('#localUser').removeClass('is-hidden');
        }
    };

    VideoChatView.prototype.unmute = function (callType) {
        curSession.unmute(callType);
        if (callType === 'video') {
            $('#localStream').removeClass('is-hidden');
            $('#localUser').addClass('is-hidden');
        }
    };

    /* Private
    --------------------------------------------------------------------------*/
    function closeStreamScreen(id) {
        var dialogId = $('li.list-item.dialog-item[data-id="' + id + '"]').data('dialog');
        var $chat = $('.l-chat[data-dialog="' + dialogId + '"]');
        var $declineButton = $('.btn_decline[data-dialog="' + dialogId + '"]');
        var callingSignal = document.getElementById('callingSignal');
        var endCallSignal = document.getElementById('endCallSignal');
        var ringtoneSignal = document.getElementById('ringtoneSignal');
        var incomingCall;

        if ($chat[0] && ($chat.find('.mediacall')[0])) {
            if (Settings.get('sounds_notify') && SyncTabs.get()) {
                callingSignal.pause();
                endCallSignal.play();
            }
            clearTimeout(callTimer);
            curSession = {};
            VideoChat.session = null;
            VideoChat.caller = null;
            VideoChat.callee = null;
            self.type = null;

            VoiceMessage.resetRecord();

            $chat.parent('.chatView').removeClass('j-mediacall');
            $chat.find('.mediacall').remove();
            $chat.find('.l-chat-header').show();
            $chat.find('.l-chat-content').css({
                height: 'calc(100% - 140px)'
            });
        } else if ($declineButton[0]) {
            incomingCall = $declineButton.parents('.incoming-call');
            incomingCall.remove();

            if ($('#popupIncoming .mCSB_container').children().length === 0) {
                closePopup();
                if (Settings.get('sounds_notify')) {
                    ringtoneSignal.pause();
                }
            }
        }

        addCallTypeIcon(id, null);
    }

    function switchOffDevice(event) {
        var $obj = $(event.target).data('id') ? $(event.target) : $(event.target).parent();
        var dialogId = $obj.data('dialog');
        var deviceType = $obj.attr('class').match(/btn_camera_off/) ? 'video' : 'audio';
        var msg = deviceType === 'video' ? 'Camera' : 'Mic';

        if (self.type !== deviceType && self.type === 'audio') {
            $obj.addClass('off');
            $obj.attr('title', msg + ' is off');
            return true;
        }

        if ($obj.is('.off')) {
            self.unmute(deviceType);
            if (deviceType === 'video') {
                curSession.update({
                    dialog_id: dialogId,
                    unmute: deviceType
                });
            }
            $obj.removeClass('off');
            $obj.removeAttr('title');
        } else {
            self.mute(deviceType);
            if (deviceType === 'video') {
                curSession.update({
                    dialog_id: dialogId,
                    mute: deviceType
                });
            }
            $obj.addClass('off');
            $obj.attr('title', msg + ' is off');
        }

        return false;
    }

    function createAndShowNotification(paramsObg) {
        var cancelNotify = !Settings.get('calls_notify');
        var isNotMainTab = !SyncTabs.get();
        var msg;
        var params;
        var title;
        var options;

        if (cancelNotify || isNotMainTab) {
            return;
        }

        msg = {
            callState: paramsObg.callState,
            dialog_id: paramsObg.dialogId,
            sender_id: paramsObg.id,
            caller: paramsObg.id,
            type: 'chat',
            callType: capitaliseFirstLetter(paramsObg.callType)
        };

        params = {
            user: User,
            dialogs: Entities.Collections.dialogs,
            contacts: ContactList.contacts
        };

        title = Helpers.Notifications.getTitle(msg, params);
        options = Helpers.Notifications.getOptions(msg, params);

        if (QMCONFIG.notification && QBNotification.isSupported() && !window.isQMAppActive) {
            if (!QBNotification.needsPermission()) {
                Helpers.Notifications.show(title, options);
            } else {
                QBNotification.requestPermission(function (state) {
                    if (state === 'granted') {
                        Helpers.Notifications.show(title, options);
                    }
                });
            }
        }
    }

    function addCallTypeIcon(id, callType) {
        var $status = $('li.dialog-item[data-id="' + id + '"]').find('span.status');

        if (callType === 'video') {
            $status.addClass('icon_videocall');
        } else if (callType === 'audio') {
            $status.addClass('icon_audiocall');
        } else {
            if ($status.hasClass('icon_videocall')) {
                $status.removeClass('icon_videocall');
            }

            $status.removeClass('icon_audiocall');
        }
    }

    function stopIncomingCall(id) {
        var dialogId = $('li.list-item.dialog-item[data-id="' + id + '"]').data('dialog');
        var $declineButton = $('.btn_decline[data-dialog="' + dialogId + '"]');

        clearTimeout(sendAutoReject);
        sendAutoReject = undefined;

        $declineButton.parents('.incoming-call').remove();

        if ($('#popupIncoming .mCSB_container').children().length === 0) {
            closePopup();
            if (Settings.get('sounds_notify')) {
                document.getElementById('ringtoneSignal').pause();
            }
        }

        curSession = {};
        VideoChat.session = null;
        VideoChat.caller = null;
        VideoChat.callee = null;
        self.type = null;

        return false;
    }

    function openPopup($objDom) {
        $objDom.add('.popups').addClass('is-overlay');
    }

    function closePopup() {
        $('.is-overlay:not(.chat-occupants-wrap)').removeClass('is-overlay');
        $('.temp-box').remove();

        if ($('.attach-video video')[0]) {
            $('.attach-video video')[0].pause();
        }
    }

    function setDuration(currentTime) {
        var c = currentTime || 0;
        $('.mediacall-info-duration').text(getTimer(c));
        callTimer = setTimeout(function () {
            c += 1;
            setDuration(c);
        }, 1000);
    }

    function getTimer(time) {
        var h; var min; var
            sec;

        h = Math.floor(time / 3600);
        h = h >= 10 ? h : '0' + h;
        min = Math.floor(time / 60);
        min = min >= 10 ? min : '0' + min;
        sec = Math.floor(time % 60);
        sec = sec >= 10 ? sec : '0' + sec;

        return h + ':' + min + ':' + sec;
    }

    function fixScroll() {
        var $chat = $('.l-chat:visible');
        var containerHeight = $chat.find('.l-chat-content .mCSB_container').height();
        var chatContentHeight = $chat.find('.l-chat-content').height();
        var draggerContainerHeight = $chat.find('.l-chat-content .mCSB_draggerContainer').height();
        var draggerHeight = $chat.find('.l-chat-content .mCSB_dragger').height();

        $chat.find('.l-chat-content .mCSB_container').css({
            top: chatContentHeight - containerHeight + 'px'
        });
        $chat.find('.l-chat-content .mCSB_dragger').css({
            top: draggerContainerHeight - draggerHeight + 'px'
        });
    }

    function capitaliseFirstLetter(string) {
        return string.charAt(0).toUpperCase() + string.slice(1);
    }

    function setScreenStyle() {
        if ($('.mediacall').outerHeight() <= 260) {
            $('.mediacall').addClass('small_screen');
        } else {
            $('.mediacall').removeClass('small_screen');
        }
    }

    return VideoChatView;
});
