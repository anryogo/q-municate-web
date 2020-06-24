const $ = require('jquery');
const QB = require('quickblox');
const QMCONFIG = require('config');
const Helpers = require('../helpers');

/*
 * Q-municate chat application
 *
 * VideoChat Module
 *
 */
let curSession;
let self;

function VideoChat(app) {
  this.app = app;
  this.session = {};
  self = this;
}

VideoChat.prototype.getUserMedia = function(options, callType, callback) {
  const { User } = this.app.models;
  const params = {
    audio: true,
    video: callType === 'video',
    elemId: 'localStream',
    options: {
      muted: true,
      mirror: true,
    },
  };

  if (!options.isCallee) {
    if (callType === 'video') {
      self.session = QB.webrtc.createNewSession(
        [options.opponentId],
        QB.webrtc.CallType.VIDEO,
        null,
        { bandwidth: 512 },
      );
    } else {
      self.session = QB.webrtc.createNewSession(
        [options.opponentId],
        QB.webrtc.CallType.AUDIO,
      );
    }
  }

  curSession = self.session;

  curSession.getUserMedia(params, (err, stream) => {
    if (err) {
      Helpers.log('Error', err);
      if (!options.isCallee) {
        callback(err, null);
      } else {
        self.sendMessage(options.opponentId, '3', null, options.dialogId, callType, true);
        callback(err, null);
      }
    } else {
      Helpers.log('Stream', stream);

      if (!$(`.l-chat[data-dialog="${options.dialogId}"]`).find('.mediacall')[0]) {
        stream.stop({});
        return;
      }

      if (options.isCallee) {
        curSession.accept({});
        self.caller = options.opponentId;
        self.callee = User.contact.id;
      } else {
        curSession.call({});
        self.caller = User.contact.id;
        self.callee = options.opponentId;
      }
      callback(null, stream);
    }
  });
};

// eslint-disable-next-line max-len
VideoChat.prototype.sendMessage = function(userId, state, callDuration, dialogId, callType, isErrorMessage, sessionID) {
  const jid = QB.chat.helpers.getUserJid(userId, QMCONFIG.qbAccount.appId);
  const { User } = this.app.models;
  const { Message } = this.app.models;
  const MessageView = this.app.views.Message;
  const VideoChatView = this.app.views.VideoChat;
  const DialogView = this.app.views.Dialog;
  const time = Math.floor(Date.now() / 1000);
  const $dialogItem = $(`.l-list-wrap section:not(#searchList) .dialog-item[data-dialog="${dialogId}"]`);
  const selected = $(`[data-dialog = ${dialogId}]`).is('.is-selected');
  let unread = parseInt($dialogItem.length > 0
            && $dialogItem.find('.unread').text().length > 0
    ? $dialogItem.find('.unread').text() : 0, 10);
  let extension;

  if (!isErrorMessage) {
    extension = {
      save_to_history: 1,
      date_sent: time,
      // eslint-disable-next-line no-nested-ternary
      callType: state === '2' ? (callType === 'video' ? '2' : '1') : (VideoChatView.type === 'video' ? '2' : '1'),
      callState: state === '1' && !callDuration ? '2' : state,
      caller: state === '2' ? userId : self.caller,
      callee: state === '2' ? User.contact.id : self.callee,
    };

    if (callDuration) extension.callDuration = Helpers.getDuration(null, callDuration);
  } else {
    extension = {
      save_to_history: 1,
      date_sent: time,
      callType: callType === 'video' ? '2' : '1',
      callState: state,
      caller: userId,
      callee: User.contact.id,
    };
  }

  if (sessionID) {
    extension.sessionID = sessionID;
  }

  const msg = {
    chat_dialog_id: dialogId,
    date_sent: time,
    sender_id: User.contact.id,
    callType: extension.callType,
    callState: extension.callState,
    caller: extension.caller,
    callee: extension.callee,
    callDuration: extension.callDuration || null,
    sessionID: extension.sessionID || null,
    online: true,
  };

  msg.id = QB.chat.send(jid, {
    type: 'chat',
    body: 'Call notification',
    extension,
  });

  const message = Message.create(msg);
  Helpers.log(message);
  MessageView.addItem(message, true, true);

  // show counter on dialog item about missed calls
  if (!selected) {
    unread += 1;
    $dialogItem.find('.unread').text(unread);
    DialogView.getUnreadCounter(dialogId);
  }

  Helpers.Dialogs.moveDialogToTop(dialogId);
};

/* Private
---------------------------------------------------------------------- */

module.exports = VideoChat;
