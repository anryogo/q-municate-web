const $ = require('jquery');
const QB = require('quickblox');
const QBNotification = require('web-notifications');

const QMCONFIG = require('config');
const Entities = require('../entities');
const Helpers = require('../helpers');
const QMHtml = require('../qmhtml');

/*
 * Q-municate chat application
 *
 * VideoChat View Module
 *
 */
let self;
let User;
let Settings;
let VideoChat;
let VoiceMessage;
let ContactList;
let SyncTabs;
let callTimer;
let sendAutoReject;
let curSession = {};
const isFirefox = navigator.userAgent.toLowerCase().indexOf('firefox') > -1;

function VideoChatView(app) {
  this.app = app;
  self = this;

  /* eslint-disable prefer-destructuring */
  Settings = this.app.models.Settings;
  SyncTabs = this.app.models.SyncTabs;
  User = this.app.models.User;
  ContactList = this.app.models.ContactList;
  VideoChat = this.app.models.VideoChat;
  VoiceMessage = this.app.models.VoiceMessage;
  /* eslint-enable prefer-destructuring */
}

VideoChatView.prototype.cancelCurrentCalls = function() {
  const $mediacall = $('.mediacall');

  if ($mediacall.length > 0) {
    $mediacall.find('.btn_hangup').click();
  }
};

VideoChatView.prototype.clearChat = function() {
  const $chatView = $('.chatView');

  if ($chatView.length > 1) {
    $chatView.first().remove();
  }
};

VideoChatView.prototype.init = function() {
  const DialogView = this.app.views.Dialog;
  const { Dialog } = this.app.models;

  $('body').on('click', '.videoCall, .audioCall', function() {
    let $this = $(this);
    let className;
    let userId;
    let $dialogItem;
    let dialogId;

    if (QB.webrtc) {
      $this = $(this);
      className = $this.attr('class');
      userId = $this.data('id');
      $dialogItem = $(`.j-dialogItem[data-id="${userId}"]`);

      if ($dialogItem.length) {
        dialogId = $dialogItem.data('dialog');
        openChatAndStartCall(dialogId);
      } else {
        Dialog.restorePrivateDialog(userId, (dialog) => {
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

  $('#popupIncoming').on('click', '.btn_decline', function() {
    const $self = $(this);
    const $incomingCall = $self.parents('.incoming-call');
    const opponentId = $self.data('id');
    const dialogId = $self.data('dialog');
    const callType = $self.data('calltype');
    const audioSignal = document.getElementById('ringtoneSignal');

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

  $('#popupIncoming').on('click', '.btn_accept', function() {
    const $self = $(this);

    self.cancelCurrentCalls();

    clearTimeout(sendAutoReject);
    sendAutoReject = undefined;

    const id = $self.data('id');
    const $dialogItem = $(`.dialog-item[data-id="${id}"]`);

    DialogView.htmlBuild($dialogItem);

    const dialogId = $self.data('dialog');
    const sessionId = $self.data('session');
    const callType = $self.data('calltype');
    const audioSignal = $('#ringtoneSignal')[0];
    const params = self.build(dialogId);
    const $chat = $(`.l-chat[data-dialog="${dialogId}"]`);

    $self.parents('.incoming-call').remove();
    $('#popupIncoming .mCSB_container').children().each(() => {
      $self.find('.btn_decline').click();
    });

    closePopup();

    if (Settings.get('sounds_notify')) {
      audioSignal.pause();
    }

    params.isCallee = true;

    VideoChat.getUserMedia(params, callType, (err) => {
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

  $('body').on('click', '.btn_hangup', function() {
    const $self = $(this);

    self.clearChat();

    const $chat = $self.parents('.l-chat');
    const opponentId = $self.data('id');
    const dialogId = $self.data('dialog');
    const callType = curSession.callType === 1 ? 'video' : 'audio';
    const duration = $self.parents('.mediacall').find('.mediacall-info-duration').text();
    const callingSignal = $('#callingSignal')[0];
    const endCallSignal = $('#endCallSignal')[0];
    const isErrorMessage = $self.data('errorMessage');

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
      height: 'calc(100% - 140px)',
    });

    addCallTypeIcon(opponentId, null);

    return false;
  });

  $('body').on('click', '.btn_camera_off, .btn_mic_off', switchOffDevice);

  // full-screen-mode
  $('body').on('click', '.btn_full-mode', () => {
    const mediaScreen = document.getElementsByClassName('mediacall')[0];
    let isFullScreen = false;

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

  $(window).on('resize', () => {
    setScreenStyle();
  });
};

VideoChatView.prototype.onCall = function(session, extension) {
  let htmlTpl;
  let tplParams;

  if (User.contact.id === session.initiatorID) {
    return;
  }

  if ($('div.popups.is-overlay').length) {
    $('.is-overlay:not(.chat-occupants-wrap)').removeClass('is-overlay');
  }

  const audioSignal = document.getElementById('ringtoneSignal');
  const $incomings = $('#popupIncoming');
  const id = session.initiatorID;
  const contact = ContactList.contacts[id];
  const callType = (session.callType === 1 ? 'video' : 'audio') || extension.call_type;
  const userName = contact.full_name || extension.full_name;
  const userAvatar = contact.avatar_url || extension.avatar;
  const $dialogItem = $(`.j-dialogItem[data-id="${id}"]`);
  let dialogId = $dialogItem.length ? $dialogItem.data('dialog') : null;
  const autoReject = QMCONFIG.QBconf.webrtc.answerTimeInterval * 1000;

  if (!dialogId && ContactList.roster[id]) {
    self.app.models.Dialog.restorePrivateDialog(id, (dialog) => {
      dialogId = dialog.get('id');
      incomingCall();
    });
  } else {
    incomingCall();
  }

  function incomingCall() {
    tplParams = {
      userAvatar,
      callTypeUС: capitaliseFirstLetter(callType),
      callType,
      userName,
      dialogId,
      sessionId: session.ID,
      userId: id,
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
      id,
      dialogId,
      callState: '4',
      callType,
    });

    sendAutoReject = setTimeout(() => {
      $('.btn_decline').click();
    }, autoReject);
  }
};

VideoChatView.prototype.onIgnored = function(state, session, id, extension) {
  let dialogId;
  let callType;

  if ((state === 'onAccept') && (User.contact.id === id)) {
    stopIncomingCall(session.initiatorID);
  }
  if ((state === 'onStop') && (User.contact.id === id)) {
    closeStreamScreen(id);
  }
  // send message to caller that user is busy
  if ((state === 'onCall') && (User.contact.id !== id)) {
    dialogId = $(`li.list-item.dialog-item[data-id="${id}"]`).data('dialog');
    callType = (extension.callType === '1' ? 'video' : 'audio') || extension.call_type;

    VideoChat.sendMessage(id, '2', null, dialogId, callType);
  }
};

VideoChatView.prototype.onAccept = function(session, id) {
  const audioSignal = document.getElementById('callingSignal');
  const dialogId = $(`li.list-item.dialog-item[data-id="${id}"]`).data('dialog');
  const callType = self.type;

  if (Settings.get('sounds_notify')) {
    audioSignal.pause();
  }

  self.sessionID = session.ID;

  addCallTypeIcon(id, callType);

  createAndShowNotification({
    id,
    dialogId,
    callState: '5',
    callType,
  });
};

VideoChatView.prototype.onRemoteStream = function(session, id, stream) {
  const video = document.getElementById('remoteStream');

  curSession.attachMediaStream('remoteStream', stream);
  $('.mediacall .btn_full-mode').prop('disabled', false);

  if (self.type === 'video') {
    video.addEventListener('timeupdate', () => {
      const duration = getTimer(Math.floor(video.currentTime));
      $('.mediacall-info-duration').text(duration);
    });

    $('#remoteUser').addClass('is-hidden');
    $('#remoteStream').removeClass('is-hidden');
  } else {
    setTimeout(() => {
      setDuration();

      $('#remoteStream').addClass('is-hidden');
      $('#remoteUser').removeClass('is-hidden');
    }, 2700);
  }
};

VideoChatView.prototype.onReject = function(session, id) {
  const dialogId = $(`li.list-item.dialog-item[data-id="${id}"]`).data('dialog');
  const $chat = $(`.l-chat[data-dialog="${dialogId}"]`);
  const isCurrentUser = (User.contact.id === id);

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
    height: 'calc(100% - 140px)',
  });

  addCallTypeIcon(id, null);
};

VideoChatView.prototype.onStop = function(session, id) {
  closeStreamScreen(id);
};

VideoChatView.prototype.onUpdateCall = function(session, id, extension) {
  const dialogId = $(`li.list-item.dialog-item[data-id="${id}"]`).data('dialog');
  const $chat = $(`.l-chat[data-dialog="${dialogId}"]`);
  const $selector = $(window.document.body);

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
VideoChatView.prototype.onSessionConnectionStateChangedListener = function(session, userID, connectionState) {
// connectionState === 3 (failed) - will close connection (for firefox browser)
  if (isFirefox && (connectionState === 3)) {
    curSession.closeConnection(userID);
    $('.btn_hangup').click();
  }
};

VideoChatView.prototype.onSessionCloseListener = function() {
  const opponentId = User.contact.id === VideoChat.callee
    ? VideoChat.caller
    : VideoChat.callee;

  closeStreamScreen(opponentId);
};

VideoChatView.prototype.onUserNotAnswerListener = function() {
  $('.btn_hangup').click();
};

VideoChatView.prototype.startCall = function(className, dialogId) {
  const audioSignal = document.getElementById('callingSignal');
  const params = self.build(dialogId);
  const $chat = $('.l-chat:visible');
  const callType = className.match(/audioCall/) ? 'audio' : 'video';
  const QBApiCalls = this.app.service;
  const calleeId = params.opponentId;
  const fullName = User.contact.full_name;
  const id = $chat.data('id');

  VideoChat.getUserMedia(params, callType, (err) => {
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

VideoChatView.prototype.build = function(id) {
  const $chat = id ? $(`.j-chatItem[data-dialog="${id}"]`) : $('.j-chatItem:visible');
  const userId = $chat.data('id');
  const dialogId = $chat.data('dialog');
  const contact = ContactList.contacts[userId];
  const tplParams = {
    userAvatar: User.contact.avatar_url,
    contactAvatar: contact.avatar_url,
    contactName: contact.full_name,
    dialogId,
    userId,
  };

  const htmlTpl = QMHtml.VideoChat.buildTpl(tplParams);

  $chat.parent('.chatView').addClass('j-mediacall');
  $chat.prepend(htmlTpl);
  $chat.find('.l-chat-header').hide();
  $chat.find('.l-chat-content').css({
    height: 'calc(50% - 90px)',
  });

  setScreenStyle();

  return {
    opponentId: userId,
    dialogId,
  };
};

VideoChatView.prototype.mute = function(callType) {
  curSession.mute(callType);
  if (callType === 'video') {
    $('#localStream').addClass('is-hidden');
    $('#localUser').removeClass('is-hidden');
  }
};

VideoChatView.prototype.unmute = function(callType) {
  curSession.unmute(callType);
  if (callType === 'video') {
    $('#localStream').removeClass('is-hidden');
    $('#localUser').addClass('is-hidden');
  }
};

/* Private
--------------------------------------------------------------------------*/
function closeStreamScreen(id) {
  const dialogId = $(`li.list-item.dialog-item[data-id="${id}"]`).data('dialog');
  const $chat = $(`.l-chat[data-dialog="${dialogId}"]`);
  const $declineButton = $(`.btn_decline[data-dialog="${dialogId}"]`);
  const callingSignal = document.getElementById('callingSignal');
  const endCallSignal = document.getElementById('endCallSignal');
  const ringtoneSignal = document.getElementById('ringtoneSignal');
  let incomingCall;

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
      height: 'calc(100% - 140px)',
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
  const $obj = $(event.target).data('id') ? $(event.target) : $(event.target).parent();
  const dialogId = $obj.data('dialog');
  const deviceType = $obj.attr('class').match(/btn_camera_off/) ? 'video' : 'audio';
  const msg = deviceType === 'video' ? 'Camera' : 'Mic';

  if (self.type !== deviceType && self.type === 'audio') {
    $obj.addClass('off');
    $obj.attr('title', `${msg} is off`);
    return true;
  }

  if ($obj.is('.off')) {
    self.unmute(deviceType);
    if (deviceType === 'video') {
      curSession.update({
        dialog_id: dialogId,
        unmute: deviceType,
      });
    }
    $obj.removeClass('off');
    $obj.removeAttr('title');
  } else {
    self.mute(deviceType);
    if (deviceType === 'video') {
      curSession.update({
        dialog_id: dialogId,
        mute: deviceType,
      });
    }
    $obj.addClass('off');
    $obj.attr('title', `${msg} is off`);
  }

  return false;
}

function createAndShowNotification(paramsObg) {
  const cancelNotify = !Settings.get('calls_notify');
  const isNotMainTab = !SyncTabs.get();

  if (cancelNotify || isNotMainTab) {
    return;
  }

  const msg = {
    callState: paramsObg.callState,
    dialog_id: paramsObg.dialogId,
    sender_id: paramsObg.id,
    caller: paramsObg.id,
    type: 'chat',
    callType: capitaliseFirstLetter(paramsObg.callType),
  };
  const params = {
    user: User,
    dialogs: Entities.Collections.dialogs,
    contacts: ContactList.contacts,
  };

  const title = Helpers.Notifications.getTitle(msg, params);
  const options = Helpers.Notifications.getOptions(msg, params);

  if (QMCONFIG.notification && QBNotification.isSupported() && !window.isQMAppActive) {
    if (!QBNotification.needsPermission()) {
      Helpers.Notifications.show(title, options);
    } else {
      QBNotification.requestPermission((state) => {
        if (state === 'granted') {
          Helpers.Notifications.show(title, options);
        }
      });
    }
  }
}

function addCallTypeIcon(id, callType) {
  const $status = $(`li.dialog-item[data-id="${id}"]`).find('span.status');

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
  const dialogId = $(`li.list-item.dialog-item[data-id="${id}"]`).data('dialog');
  const $declineButton = $(`.btn_decline[data-dialog="${dialogId}"]`);

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
  let c = currentTime || 0;
  $('.mediacall-info-duration').text(getTimer(c));
  callTimer = setTimeout(() => {
    c += 1;
    setDuration(c);
  }, 1000);
}

function getTimer(time) {
  let h; let min; let
    sec;

  h = Math.floor(time / 3600);
  h = h >= 10 ? h : `0${h}`;
  min = Math.floor(time / 60);
  min = min >= 10 ? min : `0${min}`;
  sec = Math.floor(time % 60);
  sec = sec >= 10 ? sec : `0${sec}`;

  return `${h}:${min}:${sec}`;
}

function fixScroll() {
  const $chat = $('.l-chat:visible');
  const containerHeight = $chat.find('.l-chat-content .mCSB_container').height();
  const chatContentHeight = $chat.find('.l-chat-content').height();
  const draggerContainerHeight = $chat.find('.l-chat-content .mCSB_draggerContainer').height();
  const draggerHeight = $chat.find('.l-chat-content .mCSB_dragger').height();

  $chat.find('.l-chat-content .mCSB_container').css({
    top: `${chatContentHeight - containerHeight}px`,
  });
  $chat.find('.l-chat-content .mCSB_dragger').css({
    top: `${draggerContainerHeight - draggerHeight}px`,
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

module.exports = VideoChatView;
