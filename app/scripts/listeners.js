'use strict';

const $ = require('jquery');
const Helpers = require('Helpers');
const Ps = require('perfectscrollbar');

const { QB } = window;

let self;

function Listeners(app) {
    let chatConnection = navigator.onLine;
    let position = 0;

    self = this;
    self.app = app;
    self.blockChatViewPosition = false;
    self.stateActive = null;
    self.disconnected = false;
    self.offline = false;

    self.setChatState = function(state) {
        if (typeof state === 'boolean') {
            chatConnection = state;
        } else {
            chatConnection = navigator.onLine;
            self.offline = false;
        }
    };

    self.getChatState = function() {
        return chatConnection;
    };

    self.setChatViewPosition = function(value) {
        if (!self.blockChatViewPosition) {
            position = value;
        }

        self.blockChatViewPosition = false;
    };

    self.getChatViewPosition = function() {
        let direction = '';
        let value = 0;

        if (position < 0) {
            direction = '-=';
            value -= position;
        } else {
            direction = '+=';
            value += position;
        }

        return (direction + value);
    };
}

Listeners.prototype = {

    init() {
        window.addEventListener('online', self.onNetworkStatusListener);
        window.addEventListener('offline', self.onNetworkStatusListener);

        document.addEventListener('webkitfullscreenchange', self.onFullScreenChange);
        document.addEventListener('mozfullscreenchange', self.onFullScreenChange);
        document.addEventListener('fullscreenchange', self.onFullScreenChange);
    },

    setQBHandlers() {
        const ContactListView = self.app.views.ContactList;
        const MessageView = self.app.views.Message;
        const VideoChatView = self.app.views.VideoChat;

        QB.chat.onMessageListener = MessageView.onMessage;
        QB.chat.onMessageTypingListener = MessageView.onMessageTyping;
        QB.chat.onSystemMessageListener = MessageView.onSystemMessage;
        QB.chat.onDeliveredStatusListener = MessageView.onDeliveredStatus;
        QB.chat.onReadStatusListener = MessageView.onReadStatus;

        QB.chat.onContactListListener = ContactListView.onPresence;
        QB.chat.onSubscribeListener = ContactListView.onSubscribe;
        QB.chat.onConfirmSubscribeListener = ContactListView.onConfirm;
        QB.chat.onRejectSubscribeListener = ContactListView.onReject;

        QB.chat.onDisconnectedListener = self.onDisconnected;
        QB.chat.onReconnectListener = self.onReconnected;
        QB.chat.onReconnectFailedListener = self.onReconnectFailed;

        if (QB.webrtc) {
            QB.webrtc.onCallListener = VideoChatView.onCall;
            QB.webrtc.onAcceptCallListener = VideoChatView.onAccept;
            QB.webrtc.onRejectCallListener = VideoChatView.onReject;
            QB.webrtc.onInvalidEventsListener = VideoChatView.onIgnored;
            QB.webrtc.onStopCallListener = VideoChatView.onStop;

            QB.webrtc.onUpdateCallListener = VideoChatView.onUpdateCall;
            QB.webrtc.onRemoteStreamListener = VideoChatView.onRemoteStream;
            // eslint-disable-next-line max-len
            QB.webrtc.onSessionConnectionStateChangedListener = VideoChatView.onSessionConnectionStateChangedListener;
            QB.webrtc.onSessionCloseListener = VideoChatView.onSessionCloseListener;
            QB.webrtc.onUserNotAnswerListener = VideoChatView.onUserNotAnswerListener;
        }
    },

    listenToMediaElement(selector) {
        document.querySelector(selector).onplaying = function(event) {
            // pause all media sources except started one
            Helpers.pauseAllMedia(event.target);
        };
    },

    listenToPsTotalEnd(onOrOff) {
        const scroll = document.querySelector('.j-scrollbar_aside');

        if (onOrOff) {
            scroll.addEventListener('ps-y-reach-end', self.onNextDilogsList);
        } else {
            scroll.removeEventListener('ps-y-reach-end', self.onNextDilogsList);
        }
    },

    onDisconnected() {
        if (self.stateActive) {
            self.updateDialogs(false);
            self.setChatState(false);
            switchToOfflineMode();
        }
    },

    onReconnected() {
        self.updateDialogs(true);
        self.setChatState(true);
        switchToOnlineMode();
    },

    onReconnectFailed() {
        self.app.service.disconnectChat();

        self.app.models.User.autologin(() => {
            switchToOnlineMode();
        });
    },

    onNetworkStatusListener() {
        const condition = navigator.onLine ? 'online' : 'offline';

        if (typeof self.onNetworkStatus === 'function' && condition) {
            self.onNetworkStatus(condition);
        }
    },

    onNextDilogsList() {
        if (self.activePsListener) {
            self.listenToPsTotalEnd(false);

            self.app.views.Dialog.showOldHistory((stopListener) => {
                self.onUpdatePerfectScroll();

                if (!stopListener) {
                    self.listenToPsTotalEnd(true);
                }
            });
        } else {
            self.activePsListener = true;
        }
    },

    onUpdatePerfectScroll() {
        Ps.update(document.querySelector('.j-scrollbar_aside'));
    },

    updateDialogs(reconnected) {
        const DialogView = self.app.views.Dialog;
        const dialogsCollection = self.app.entities.Collections.dialogs;

        if (reconnected) {
            DialogView.downloadDialogs();
        } else {
            dialogsCollection.forEach((dialog) => {
                if (dialog.get('type') === 2) {
                    dialog.set({
                        joined: false,
                        opened: false,
                    });
                }
            });
        }
    },

    onNetworkStatus(status) {
        if (self.getChatState()) {
            if (status === 'online') {
                self.updateDialogs(true);
                switchToOnlineMode();
            } else {
                switchToOfflineMode();
            }
        }
    },

    onFullScreenChange(event) {
        const fullscreenElement = document.fullscreenElement
                                || document.mozFullscreenElement
                                || document.webkitFullscreenElement;
        const fullscreenEnabled = document.fullscreenEnabled
                                || document.mozFullscreenEnabled
                                || document.webkitFullscreenEnabled;
        const isVideoElementTag = event.target.tagName === 'VIDEO';
        let $scroll;

        if (fullscreenEnabled && isVideoElementTag) {
            $scroll = $('.j-chatItem:visible').find('.j-scrollbar_message');

            if (fullscreenElement) {
                self.blockChatViewPosition = true;
            } else {
                $scroll.mCustomScrollbar('scrollTo', self.getChatViewPosition());
            }
        }
    },
};

//
// Private functions
//
function switchToOfflineMode() {
    if (!self.disconnected) {
        document.querySelector('.j-overlay').classList.add('is-disconnect');
        document.querySelector('.j-overlay').disabled = true;
        document.querySelector('.j-disconnect').classList.add('disconnected');
        self.disconnected = true;
    }
}

function switchToOnlineMode() {
    if (self.disconnected) {
        document.querySelector('.j-overlay').classList.remove('is-disconnect');
        document.querySelector('.j-overlay').disabled = false;
        document.querySelector('.j-disconnect').classList.remove('disconnected');
        self.disconnected = false;
    }
}

module.exports = Listeners;
