import $ from 'jquery';
import _ from 'underscore';
import QB from 'quickblox';
import QBNotification from 'web-notifications';
import QMCONFIG from 'config';
import minEmoji from 'minEmoji';
import Location from 'views/location';
import Helpers from '../helpers';
import QMHtml from '../qmhtml';
import Entities from '../entities';

/*
 * Q-municate chat application
 *
 * Message View Module
 *
 */
let self;

let User;
let Message;
let ContactList;
let Dialog;
let SyncTabs;
let Settings;

let clearTyping;
let typingList = []; // for typing statuses

const urlCache = {};

function MessageView(app) {
  this.app = app;

  /* eslint-disable prefer-destructuring */
  Settings = this.app.models.Settings;
  SyncTabs = this.app.models.SyncTabs;
  User = this.app.models.User;
  Dialog = this.app.models.Dialog;
  Message = this.app.models.Message;
  ContactList = this.app.models.ContactList;
  self = this;
  /* eslint-enable prefer-destructuring */
}

MessageView.prototype = {
  // this needs only for group chats: check if user exist in group chat
  checkSenderId(senderId, callback) {
    if (senderId !== User.contact.id) {
      ContactList.add([senderId], null, () => {
        callback();
      });
    } else {
      callback();
    }
  },

  addItem(message, isCallback, isMessageListener) {
    const { Contact } = this.app.models;
    const $chat = $(`.l-chat[data-dialog="${message.dialog_id}"]`);
    const isOnline = message.online;
    const senderID = message.sender_id;
    const { contacts } = ContactList;
    const isGroupChat = typeof $chat.data('id') === 'undefined';
    const isMyUser = senderID === User.contact.id;
    const isUserMenu = isGroupChat && !isMyUser;
    let contact;

    if (isCallback && isMessageListener) {
      updateDialogItem(message);
    }

    if (
      typeof $chat[0] === 'undefined' ||
      (!message.notification_type && !message.callType && !message.attachment && !message.body)
    ) {
      return;
    }

    if (message.sessionID && $(`.message[data-session="${message.sessionID}"]`)[0]) {
      return;
    }

    if (isMyUser) {
      contact = User.contact; // eslint-disable-line prefer-destructuring
    } else {
      if (!contacts[senderID]) {
        contacts[senderID] = Contact.create({ id: senderID });
      }

      contact = contacts[senderID];
    }

    this.checkSenderId(senderID, () => {
      const type =
        message.notification_type ||
        (message.callState && (parseInt(message.callState, 10) + 7).toString()) ||
        'message';
      const attachType =
        (message.attachment && message.attachment['content-type']) ||
        (message.attachment && message.attachment.type) ||
        null;
      // eslint-disable-next-line max-len
      const attachUrl =
        message.attachment &&
        (QB.content.privateUrl(message.attachment.id) || message.attachment.url || null);
      const geolocation =
        message.latitude && message.longitude
          ? {
              lat: message.latitude,
              lng: message.longitude,
            }
          : null;
      const geoCoords =
        message.attachment && message.attachment.type === 'location'
          ? getLocationFromAttachment(message.attachment)
          : null;
      const mapAttachImage = geoCoords
        ? Location.getStaticMapUrl(geoCoords, {
            size: [380, 200],
          })
        : null;
      const mapAttachLink = geoCoords ? Location.getMapUrl(geoCoords) : null;
      const recipientFullName =
        (message.recipient_id &&
          contacts[message.recipient_id] &&
          contacts[message.recipient_id].full_name) ||
        'this user';
      let occupantsNames = '';
      let addedOccupantIds;
      let occupantsIds;
      let attachParams;
      let status;
      let html;
      let mapLink;
      let imgUrl;

      if (attachType) {
        attachParams = {
          id: message.id,
          duration: message.attachment.duration || null,
          height: message.attachment.height || null,
          width: message.attachment.width || null,
          name: message.attachment.name,
          type: attachType,
          url: attachUrl,
        };
      }

      switch (type) {
        case '1':
          addedOccupantIds = _.without(
            message.added_occupant_ids.split(',').map(Number),
            contact.id
          );
          // eslint-disable-next-line max-len
          occupantsNames = Helpers.Messages.getOccupantsNames(addedOccupantIds, User, contacts);

          html = `<article class="message message_service l-flexbox l-flexbox_alignstretch" data-id="${message.sender_id}" data-type="${type}">`;
          html += '<span class="message-avatar request-button_pending"></span>';
          html += '<div class="message-container-wrap">';
          html +=
            '<div class="message-container l-flexbox l-flexbox_flexbetween l-flexbox_alignstretch">';
          html += '<div class="message-content">';
          html += `<h4 class="message-author"><span class="profileUserName" data-id="${message.sender_id}">${contact.full_name}</span> has added ${occupantsNames} to the group chat</h4>`;
          html += `</div><div class="message-info"><time class="message-time">${Helpers.getTime(
            message.date_sent
          )}</time>`;
          html += '<div class="info_indent"></div></div></div></div></article>';
          break;

        case '2':
          html = `<article id="${message.id}" class="message message_service l-flexbox l-flexbox_alignstretch" data-id="${message.sender_id}" data-type="${type}">`;
          html += '<span class="message-avatar request-button_pending"></span>';
          html += '<div class="message-container-wrap">';
          html +=
            '<div class="message-container l-flexbox l-flexbox_flexbetween l-flexbox_alignstretch">';
          html += '<div class="message-content">';

          if (message.added_occupant_ids) {
            occupantsIds = message.added_occupant_ids.split(',').map(Number);
            // eslint-disable-next-line max-len
            occupantsNames = Helpers.Messages.getOccupantsNames(occupantsIds, User, contacts);

            html += `<h4 class="message-author"><span class="profileUserName" data-id="${message.sender_id}">${contact.full_name}</span> has added ${occupantsNames}</h4>`;
          }

          if (message.deleted_occupant_ids) {
            html += `<h4 class="message-author"><span class="profileUserName" data-id="${message.sender_id}">${contact.full_name}</span> has left</h4>`;
          }

          if (message.room_name) {
            html += `<h4 class="message-author"><span class="profileUserName" data-id="${message.sender_id}">${contact.full_name}</span> has changed the chat name to "${message.room_name}"</h4>`;
          }

          if (message.room_photo) {
            html += `<h4 class="message-author"><span class="profileUserName" data-id="${message.sender_id}">${contact.full_name}</span> has changed the chat picture</h4>`;
          }

          html += `</div><div class="message-info"><time class="message-time">${Helpers.getTime(
            message.date_sent
          )}</time>`;
          html += '<div class="info_indent"></div></div></div></div></article>';
          break;

        case '4':
          html = `<article id="${message.id}" class="message message_service l-flexbox l-flexbox_alignstretch" data-id="${message.sender_id}" data-type="${type}">`;
          html += '<span class="message-avatar request-button_pending"></span>';
          html += '<div class="message-container-wrap">';
          html +=
            '<div class="message-container l-flexbox l-flexbox_flexbetween l-flexbox_alignstretch">';
          html += '<div class="message-content">';

          if (isMyUser) {
            html += '<h4 class="message-author">Your request has been sent</h4>';
          } else {
            html += `<h4 class="message-author"><span class="profileUserName" data-id="${message.sender_id}">${contact.full_name}</span> has sent a request to you</h4>`;
          }

          html += `</div><div class="message-info"><time class="message-time">${Helpers.getTime(
            message.date_sent
          )}</time>`;
          html += '<div class="info_indent"></div></div></div></div></article>';
          break;

        case '5':
          html = `<article id="${message.id}" class="message message_service l-flexbox l-flexbox_alignstretch" data-id="${message.sender_id}" data-type="${type}">`;
          html += '<span class="message-avatar request-button_ok j-requestConfirm">&#10003;</span>';
          html += '<div class="message-container-wrap">';
          html +=
            '<div class="message-container l-flexbox l-flexbox_flexbetween l-flexbox_alignstretch">';
          html += '<div class="message-content">';

          if (isMyUser) {
            html += '<h4 class="message-author">You have accepted a request</h4>';
          } else {
            html += '<h4 class="message-author">Your request has been accepted</h4>';
          }

          html += `</div><div class="message-info"><time class="message-time">${Helpers.getTime(
            message.date_sent
          )}</time>`;
          html += '<div class="info_indent"></div></div></div></div></article>';
          break;

        case '6':
          html = `<article id="${message.id}" class="message message_service l-flexbox l-flexbox_alignstretch" data-id="${message.sender_id}" data-type="${type}">`;
          html +=
            '<span class="message-avatar request-button_cancel j-requestCancel">&#10005;</span>';
          html += '<div class="message-container-wrap">';
          html +=
            '<div class="message-container l-flexbox l-flexbox_flexbetween l-flexbox_alignstretch">';
          html += '<div class="message-content">';

          if (isMyUser) {
            html += '<h4 class="message-author">You have rejected a request';
          } else {
            html += '<h4 class="message-author">Your request has been rejected</h4>';
            html += '<button class="btn btn_request_again j-requestAgain">';
            html +=
              '<img class="btn-icon btn-icon_request" src="images/icon-request.svg" alt="request">Send Request Again';
            html += '</button>';
          }

          html += `</div><div class="message-info"><time class="message-time">${Helpers.getTime(
            message.date_sent
          )}</time>`;
          html += '<div class="info_indent"></div></div></div></div></article>';
          break;

        case '7':
          html = `<article id="${message.id}" class="message message_service l-flexbox l-flexbox_alignstretch" data-id="${message.sender_id}" data-type="${type}">`;
          html += '<span class="message-avatar request-button_pending"></span>';
          html += '<div class="message-container-wrap">';
          html +=
            '<div class="message-container l-flexbox l-flexbox_flexbetween l-flexbox_alignstretch">';
          html += '<div class="message-content">';

          if (isMyUser) {
            html += `<h4 class="message-author">You have deleted ${recipientFullName} from your contact list`;
          } else {
            html += '<h4 class="message-author">You have been deleted from the contact list</h4>';
            html +=
              '<button class="btn btn_request_again btn_request_again_delete j-requestAgain">';
            html +=
              '<img class="btn-icon btn-icon_request" src="images/icon-request.svg" alt="request">Send Request Again</button>';
          }

          html += `</div><div class="message-info"><time class="message-time">${Helpers.getTime(
            message.date_sent
          )}</time>`;
          html += '<div class="info_indent"></div></div></div></div></article>';
          break;

        // calls messages
        case '8':
          if (message.caller) {
            html = `<article id="${message.id}" class="message message_service l-flexbox l-flexbox_alignstretch" data-id="${message.sender_id}" data-type="${type}" data-session="${message.sessionID}">`;

            if (message.caller === User.contact.id) {
              html += `<span class="message-avatar request-call ${
                message.callType === '2' ? 'request-video_outgoing' : 'request-audio_outgoing'
              }"></span>`;
            } else {
              html += `<span class="message-avatar request-call ${
                message.callType === '2' ? 'request-video_incoming' : 'request-audio_incoming'
              }"></span>`;
            }

            html += '<div class="message-container-wrap">';
            html +=
              '<div class="message-container l-flexbox l-flexbox_flexbetween l-flexbox_alignstretch">';
            html += '<div class="message-content">';

            if (message.caller === User.contact.id) {
              html += `<h4 class="message-author">Outgoing ${
                message.callType === '2' ? 'Video' : ''
              } Call, ${Helpers.getDuration(message.callDuration)}`;
            } else {
              html += `<h4 class="message-author">Incoming ${
                message.callType === '2' ? 'Video' : ''
              } Call, ${Helpers.getDuration(message.callDuration)}`;
            }

            html += `</div><div class="message-info"><time class="message-time">${Helpers.getTime(
              message.date_sent
            )}</time>`;
            html += '<div class="info_indent"></div></div></div></div></article>';
          }

          break;

        case '9':
          if (message.caller) {
            html = `<article id="${message.id}" class="message message_service l-flexbox l-flexbox_alignstretch" data-id="${message.sender_id}" data-type="${type}">`;

            if (message.caller === User.contact.id) {
              html += `<span class="message-avatar request-call ${
                message.callType === '2' ? 'request-video_ended' : 'request-audio_ended'
              }"></span>`;
            } else {
              html += `<span class="message-avatar request-call ${
                message.callType === '2' ? 'request-video_missed' : 'request-audio_missed'
              }"></span>`;
            }

            html += '<div class="message-container-wrap">';
            html +=
              '<div class="message-container l-flexbox l-flexbox_flexbetween l-flexbox_alignstretch">';
            html += '<div class="message-content">';

            if (message.caller === User.contact.id) {
              html += '<h4 class="message-author">No Answer';
            } else {
              html += `<h4 class="message-author">Missed ${
                message.callType === '2' ? 'Video' : ''
              } Call`;
            }

            html += `</div><div class="message-info"><time class="message-time">${Helpers.getTime(
              message.date_sent
            )}</time>`;
            html += '<div class="info_indent"></div></div></div></div></article>';
          }

          break;

        case '10':
          if (message.caller) {
            html = `<article id="${message.id}" class="message message_service l-flexbox l-flexbox_alignstretch" data-id="${message.sender_id}" data-type="${type}">`;
            html += `<span class="message-avatar request-call ${
              message.callType === '2' ? 'request-video_ended' : 'request-audio_ended'
            }"></span>`;
            html += '<div class="message-container-wrap">';
            html +=
              '<div class="message-container l-flexbox l-flexbox_flexbetween l-flexbox_alignstretch">';
            html += '<div class="message-content">';

            if (message.caller === User.contact.id) {
              html += `<h4 class="message-author">${
                contacts[message.callee].full_name
              } doesn't have camera and/or microphone.`;
            } else {
              html += '<h4 class="message-author">Camera and/or microphone wasn\'t found.';
            }

            html += `</div><div class="message-info"><time class="message-time">${Helpers.getTime(
              message.date_sent
            )}</time>`;
            html += '<div class="info_indent"></div></div></div></div></article>';
          }

          break;

        default:
          status = isOnline ? message.status : 'Not delivered yet';

          if (isMyUser) {
            html = `<article id="${
              message.id
            }" class="message is-own l-flexbox l-flexbox_alignstretch${
              message.stack ? ' without_border' : ''
            }" data-id="${message.sender_id}" data-type="${type}">`;
          } else {
            html = `<article id="${message.id}" class="message l-flexbox l-flexbox_alignstretch${
              message.stack ? ' without_border' : ''
            }" data-id="${message.sender_id}" data-type="${type}">`;
          }

          html += `<div class="message-avatar avatar profileUserAvatar${
            // eslint-disable-next-line no-nested-ternary
            message.stack ? ' is-hidden' : isUserMenu ? ' userMenu j-userMenu' : ''
          }" style="background-image:url(${contact.avatar_url})" data-id="${
            message.sender_id
          }"></div>`;
          html += '<div class="message-container-wrap">';
          html +=
            '<div class="message-container l-flexbox l-flexbox_flexbetween l-flexbox_alignstretch">';
          html += `<div class="message-content${message.stack ? ' indent' : ''}">`;
          html += `<h4 class="message-author${
            message.stack ? ' is-hidden' : ''
          }"><span class="profileUserName" data-id="${message.sender_id}">${
            contact.full_name
          }</span></h4>`;

          if (attachType && attachType.indexOf('image') > -1) {
            html += '<div class="message-body">';
            html += `<div id="image_${message.id}" class="preview preview-photo" data-url="${attachUrl}" data-name="${message.attachment.name}">`;
            html += `<img src="${attachUrl}" alt="attach"></div></div></div>`;
          } else if (attachType && attachType.indexOf('audio') > -1) {
            html += `<div class="message-body"><div id="audio_player_${message.id}" class="audio_player"></div></div></div>`;
          } else if (attachType && attachType.indexOf('video') > -1) {
            html += `<div class="message-body"><div class="media_title">${message.attachment.name}</div>`;
            html +=
              `<video id="video_${message.id}" class="video_player j-videoPlayer" preload="none" data-source="${attachUrl}" poster="images/ic-play-video.svg">` +
              '</video></div></div>';
          } else if (attachType && attachType.indexOf('location') > -1) {
            html += '<div class="message-body">';
            html += `<a class="open_googlemaps" href="${mapAttachLink}" target="_blank">`;
            html += `<img id="attach_${message.id}" src="${mapAttachImage}" alt="attach" class="attach_map"></a></div></div>`;
          } else if (attachType && attachType.indexOf('file') > -1) {
            html += '<div class="message-body">';
            html += `<a id="attach_${message.id}" class="attach-file" href="${attachUrl}" download="${message.attachment.name}">${message.attachment.name}</a>`;
            html += `<span class="attach-size">${getFileSize(
              message.attachment.size
            )}</span></div></div>`;
          } else {
            html += `<div class="message-body">${minEmoji(
              Helpers.Messages.parser(message.body)
            )}</div></div>`;
          }

          html += `<div class="message-info"><time class="message-time" data-time="${
            message.date_sent
          }">${Helpers.getTime(message.date_sent)}</time>`;
          html += `<div class="message-status is-hidden">${status}</div>`;
          html += '<div class="message-geo j-showlocation"></div></div>';
          html += '</div></div></article>';

          break;
      }

      if (isCallback) {
        if (isMessageListener) {
          $chat.find('.l-chat-content .mCSB_container').append(html);
          setAttachSize(attachParams);
          getUrlPreview(message.id);
          smartScroll();
        } else {
          $chat.find('.l-chat-content .mCSB_container').prepend(html);
          setAttachSize(attachParams);
          getUrlPreview(message.id);
        }
      } else {
        if ($chat.find('.l-chat-content .mCSB_container')[0]) {
          $chat.find('.l-chat-content .mCSB_container').prepend(html);
        } else {
          $chat.find('.l-chat-content').prepend(html);
        }

        setAttachSize(attachParams);
        getUrlPreview(message.id);
        smartScroll();
      }

      if (geolocation) {
        mapLink = Location.getMapUrl(geolocation);
        imgUrl = Location.getStaticMapUrl(geolocation);

        QMHtml.Messages.setMap({
          id: message.id,
          mapLink,
          imgUrl,
        });
      }

      if (attachParams) {
        self.updateMediaElement(attachParams);
      }

      if (message.sender_id === User.contact.id && message.delivered_ids.length > 0) {
        self.addStatusMessages(message.id, message.dialog_id, 'delivered', false);
      }

      if (message.sender_id === User.contact.id && message.read_ids.length > 1) {
        self.addStatusMessages(message.id, message.dialog_id, 'displayed', false);
      }

      smartScroll();
    });
  },

  addStatusMessages(messageId, dialogId, messageStatus, isListener) {
    const $chat = $(`.l-chat[data-dialog="${dialogId}"]`);
    const time = $chat.find(
      `article#${messageId} .message-container-wrap .message-container .message-time`
    );
    const statusHtml = $chat.find(
      `article#${messageId} .message-container-wrap .message-container .message-status`
    );

    if (messageStatus === 'displayed') {
      if (statusHtml.hasClass('delivered')) {
        statusHtml.removeClass('delivered').addClass('displayed').html('Seen');
      } else {
        statusHtml.addClass('displayed').html('Seen');
      }
    } else if (statusHtml.hasClass('displayed') && messageStatus === 'delivered') {
      return;
    } else if (statusHtml.hasClass('delivered')) {
      statusHtml.html('Delivered');
    } else {
      statusHtml.addClass('delivered').html('Delivered');
    }

    if (isListener) {
      setTimeout(() => {
        time.removeClass('is-hidden');
        statusHtml.addClass('is-hidden');
      }, 1000);
      time.addClass('is-hidden');

      statusHtml.removeClass('is-hidden');
    }
  },

  sendMessage(form) {
    const jid = form.parents('.l-chat').data('jid');
    const dialogId = form.parents('.l-chat').data('dialog');
    const $textarea = form.find('.textarea');
    const $smiles = form.find('.textarea > img');
    let val = $textarea.html().trim();
    const time = Math.floor(Date.now() / 1000);
    const type = form.parents('.l-chat').is('.is-group') ? 'groupchat' : 'chat';
    const $chat = $(`.l-chat[data-dialog="${dialogId}"]`);
    const $newMessages = $(`.j-newMessages[data-dialog="${dialogId}"]`);
    const locationIsActive =
      $('.j-send_location').hasClass('btn_active') &&
      localStorage['QM.latitude'] &&
      localStorage['QM.longitude'];
    const { dialogs } = Entities.Collections;
    const dialog = dialogs.get(dialogId);
    let lastMessage;
    let message;
    let msg;

    if ($smiles.length > 0) {
      $smiles.each(function () {
        $(this).after($(this).data('unicode')).remove();
      });
      val = $textarea.html();
    }

    if (form.find('.textarea > div').length > 0) {
      val = $textarea.text();
    }

    val = val.replace(/<br>/gi, '\n').trim();

    if (val.length > 0) {
      // send message
      msg = {
        type,
        body: val,
        extension: {
          save_to_history: 1,
          dialog_id: dialogId,
          date_sent: time,
        },
        markable: 1,
      };

      if (locationIsActive) {
        msg.extension.latitude = localStorage['QM.latitude'];
        msg.extension.longitude = localStorage['QM.longitude'];
      }

      msg.id = QB.chat.send(jid, msg);

      message = Message.create({
        chat_dialog_id: dialogId,
        body: val,
        date_sent: time,
        sender_id: User.contact.id,
        latitude: localStorage['QM.latitude'] || null,
        longitude: localStorage['QM.longitude'] || null,
        _id: msg.id,
        type,
        online: true,
      });

      if (type === 'chat') {
        Helpers.Dialogs.moveDialogToTop(dialogId);
        lastMessage = $chat.find('article[data-type="message"]').last();
        message.stack = Message.isStack(true, message, lastMessage);
        self.addItem(message, true, true);

        if ($newMessages.length) {
          $newMessages.remove();
        }
      }

      if (dialog) {
        dialog.set({
          last_message: val,
          last_message_date_sent: time,
        });
      }
    }
  },

  // send start or stop typing status to chat or groupchat
  sendTypingStatus(jid, start) {
    const roomJid = QB.chat.helpers.getRoomJid(jid);
    const xmppRoomJid = roomJid.split('/')[0];

    if (start) {
      QB.chat.sendIsTypingStatus(xmppRoomJid);
    } else {
      QB.chat.sendIsStopTypingStatus(xmppRoomJid);
    }
  },

  // claer the list typing when switch to another chat
  clearTheListTyping() {
    $('.j-typing').empty();
    typingList = [];
  },

  onMessage(id, message) {
    if (message.type === 'error') {
      return;
    }

    /* eslint-disable vars-on-top */
    const DialogView = self.app.views.Dialog;
    const ContactListView = self.app.views.ContactList;
    const hiddenDialogs = sessionStorage['QM.hiddenDialogs']
      ? JSON.parse(sessionStorage['QM.hiddenDialogs'])
      : {};
    const { dialogs } = Entities.Collections;
    const { contacts } = ContactList;
    const notificationType = message.extension && message.extension.notification_type;
    const dialogId = message.extension && message.extension.dialog_id;
    // eslint-disable-next-line max-len
    const recipientId =
      message.recipient_id || (message.extension && message.extension.recipient_id) || null;
    const recipientJid = recipientId ? makeJid(recipientId) : null;
    const roomName = message.extension && message.extension.room_name;
    const roomPhoto = message.extension && message.extension.room_photo;
    let deletedId = message.extension && message.extension.deleted_occupant_ids;
    let newIds = message.extension && message.extension.added_occupant_ids;
    let occupantsIds = message.extension && message.extension.current_occupant_ids;
    const dialogItem =
      message.type === 'groupchat'
        ? $(`.l-list-wrap section:not(#searchList) .dialog-item[data-dialog="${dialogId}"]`)
        : $(`.l-list-wrap section:not(#searchList) .dialog-item[data-id="${id}"]`);
    const contactRequest = $(`.j-incomingContactRequest[data-jid="${makeJid(id)}"]`);
    const $chat =
      message.type === 'groupchat'
        ? $(`.l-chat[data-dialog="${dialogId}"]`)
        : $(`.l-chat[data-id="${id}"]`);
    const isHiddenChat = $chat.is(':hidden') || !$chat.length;
    const { roster } = ContactList;
    const isExistent =
      Boolean(dialogItem.length || contactRequest.length || roster[id]) || notificationType === '4';
    let unread = parseInt(
      dialogItem.length > 0 && dialogItem.find('.unread').text().length > 0
        ? dialogItem.find('.unread').text()
        : 0,
      10
    );
    const audioSignal = $('#newMessageSignal')[0];
    const isOfflineStorage = message.delay;
    const selected = $(`[data-dialog = ${dialogId}]`).is('.is-selected');
    const isBottom = Helpers.isBeginOfChat();
    const otherChat =
      !selected &&
      dialogItem.length > 0 &&
      notificationType !== '1' &&
      (!isOfflineStorage || message.type === 'groupchat');
    const isNotMyUser = id !== User.contact.id;
    const readBadge = `QM.${User.contact.id}_readBadge`;
    const $newMessages = $(
      `<div class="new_messages j-newMessages" data-dialog="${dialogId}"><span class="newMessages">New messages</span></div>`
    );
    const $label = $chat.find('.j-newMessages');
    const isNewMessages = $label.length;
    const dialog = dialogs.get(dialogId);
    let occupants;
    let occupant;
    let QBApiCalls;
    let Contact;
    /* eslint-enable vars-on-top */

    if (!dialog && roster[id] && notificationType !== '4') {
      Dialog.download({ _id: dialogId }, (error, results) => {
        let newDialogId;

        if (results) {
          newDialogId = Dialog.create(results.items[0]);

          DialogView.addDialogItem(dialogs.get(newDialogId), null, true);
        }
      });
    }

    if (typeof newIds === 'string') {
      newIds = newIds.split(',').map(Number);
    }

    if (typeof deletedId === 'string') {
      deletedId = deletedId.split(',').map(Number);
    }

    if (typeof occupantsIds === 'string') {
      occupantsIds = occupantsIds.split(',').map(Number);
    }

    message.sender_id = id;
    message.online = true;
    const msg = Message.create(message);

    // add or remove label about new messages
    if ($chat.length && !isHiddenChat && window.isQMAppActive && isNewMessages) {
      $label.remove();
    } else if (
      (isHiddenChat || !window.isQMAppActive) &&
      $chat.length &&
      !isNewMessages &&
      isNotMyUser
    ) {
      $chat.find('.l-chat-content .mCSB_container').append($newMessages);
    }

    if (otherChat || (!otherChat && !isBottom && isNotMyUser && isExistent)) {
      unread += 1;
      dialogItem.find('.unread').text(unread);
      DialogView.getUnreadCounter(dialogId);
    }

    // set dialogId to localStorage wich must bee read in all tabs for same user
    if (selected) {
      localStorage.removeItem(readBadge);
      localStorage.setItem(readBadge, dialogId);
    }

    // add new occupants
    if (notificationType === '2') {
      if (occupantsIds) {
        occupants = dialog.get('occupants_ids').concat(newIds);
        dialog.set('occupants_ids', occupants);
      }

      if (dialog && deletedId) {
        occupants = _.without(_.compact(dialog.get('occupants_ids')), deletedId[0]);
        dialog.set('occupants_ids', occupants);
      }

      if (roomName) {
        dialog.set('room_name', roomName);
      }

      if (roomPhoto) {
        dialog.set('room_photo', roomPhoto);
      }

      // add new people
      if (newIds) {
        ContactList.add(dialog.get('occupants_ids'), null, () => {
          let newId;

          newIds.forEach((item) => {
            newId = item.toString();

            if (newId !== User.contact.id.toString()) {
              occupant = `<a class="occupant l-flexbox_inline presence-listener" data-id="${newId}" href="#">`;
              occupant = getStatus(roster[newId], occupant);
              occupant += `<span class="name name_occupant">${contacts[newId].full_name}</span></a>`;
              $chat.find('.chat-occupants-wrap .mCSB_container').append(occupant);
            }
          });

          $chat.find('.addToGroupChat').data('ids', dialog.get('occupants_ids'));
        });
      }

      // delete occupant
      if (deletedId && msg.sender_id !== User.contact.id) {
        $chat.find(`.occupant[data-id="${id}"]`).remove();
        $chat.find('.addToGroupChat').data('ids', dialog.get('occupants_ids'));
      }

      if (deletedId && deletedId[0] === User.contact.id) {
        DialogView.deleteChat(dialogId, true);
        DialogView.decUnreadCounter(dialogId);
        dialogs.remove(dialog);
      }

      // change name
      if (roomName) {
        $chat.find('.name_chat').text(roomName).attr('title', roomName);
        $chat.find('.j-scaleAvatar').data('name', roomName);
        dialogItem.find('.name').text(roomName);
      }

      // change photo
      if (roomPhoto) {
        $chat.find('.avatar_chat').css('background-image', `url(${roomPhoto})`);
        dialogItem.find('.avatar').css('background-image', `url(${roomPhoto})`);
      }
    }

    if (notificationType !== '1') {
      Helpers.Dialogs.moveDialogToTop(dialogId);
    }

    const lastMessage = $chat.find('article[data-type="message"]').last();

    msg.stack = Message.isStack(true, msg, lastMessage);

    // subscribe message
    if (notificationType === '4') {
      QBApiCalls = self.app.service;
      Contact = self.app.models.Contact; // eslint-disable-line prefer-destructuring
      // update hidden dialogs
      hiddenDialogs[id] = dialogId;
      ContactList.saveHiddenDialogs(hiddenDialogs);
      // update contact list
      QBApiCalls.getUser(id, (user) => {
        contacts[id] = Contact.create(user);
      });
    } else {
      self.addItem(msg, true, true);
    }

    if (notificationType === '5' && isNotMyUser && isExistent) {
      ContactListView.onConfirm(id);
    }

    const isHidden = isHiddenChat || !window.isQMAppActive;
    const sentToMe = message.type !== 'groupchat' || msg.sender_id !== User.contact.id;
    const isSoundOn = Settings.get('sounds_notify');
    const isMainTab = SyncTabs.get();

    if (isExistent) {
      createAndShowNotification(msg, isHidden);
    }

    if (notificationType === '7') {
      ContactListView.onReject(id);
    }

    if (isHidden && sentToMe && isSoundOn && isMainTab && isExistent) {
      audioSignal.play();
    }

    if (dialog) {
      dialog.set({
        last_message: msg.body,
        last_message_date_sent: msg.date_sent,
        room_updated_date: msg.date_sent,
      });
    }

    if (msg.sender_id === User.contact.id && recipientJid) {
      syncContactRequestInfo({
        notification_type: notificationType,
        recipient_jid: recipientJid,
        dialog_id: dialogId,
      });
    }
  },

  onSystemMessage(message) {
    const DialogView = self.app.views.Dialog;
    const notificationType = message.extension && message.extension.notification_type;
    const dialogId = message.extension && message.extension.dialog_id;
    const roomJid = roomJidVerification(dialogId);
    const roomName = message.extension && message.extension.room_name;
    const roomPhoto = message.extension && message.extension.room_photo;
    const roomUpdatedAt = message.extension && message.extension.room_updated_date;
    const occupantsIds =
      message.extension && message.extension.current_occupant_ids
        ? message.extension.current_occupant_ids.split(',').map(Number)
        : null;
    let dialogItem = $(
      `.l-list-wrap section:not(#searchList) .dialog-item[data-dialog="${dialogId}"]`
    );
    let dialogGroupItem = $(
      `.l-list-wrap section:not(#searchList) .dialog-item[data-dialog="${dialogId}"]`
    );
    let unread = parseInt(
      dialogItem.length > 0 && dialogItem.find('.unread').text().length > 0
        ? dialogItem.find('.unread').text()
        : 0,
      10
    );
    const { dialogs } = Entities.Collections;
    let dialog;
    let msg;

    // create new group chat
    if (notificationType === '1' && dialogGroupItem.length === 0) {
      Dialog.create({
        _id: dialogId,
        type: 2,
        occupants_ids: occupantsIds,
        name: roomName,
        photo: roomPhoto,
        room_updated_date: roomUpdatedAt,
        xmpp_room_jid: roomJid,
        unread_count: 1,
        opened: false,
      });

      dialog = dialogs.get(dialogId);

      Helpers.log('Dialog', dialog.toJSON());

      ContactList.add(occupantsIds, null, () => {
        // don't create a duplicate dialog in contact list
        // eslint-disable-next-line prefer-destructuring
        dialogItem = $(
          `.l-list-wrap section:not(#searchList) .dialog-item[data-dialog="${dialogId}"]`
        )[0];

        if (dialogItem) {
          return;
        }

        if (dialog && !dialog.get('joined')) {
          QB.chat.muc.join(roomJid, () => {
            dialog.set('joined', true);
          });
        }

        DialogView.addDialogItem(dialog);
        unread += 1;
        dialogGroupItem = $(
          `.l-list-wrap section:not(#searchList) .dialog-item[data-dialog="${dialogId}"]`
        );

        message.online = true;
        msg = Message.create(message);

        // Don't show any notification if system message from current User
        if (msg.sender_id !== User.contact.id) {
          dialogGroupItem.find('.unread').text(unread);
          DialogView.getUnreadCounter(dialogId);
        }

        self.addItem(msg, true, true);
        createAndShowNotification(msg, true);
      });
    }
  },

  onMessageTyping(isTyping, userId, dialogId) {
    const ContactListMsg = self.app.models.ContactList;
    const { contacts } = ContactListMsg;
    const contact = contacts[userId];
    const $chat =
      dialogId === null
        ? $(`.l-chat[data-id="${userId}"]`)
        : $(`.l-chat[data-dialog="${dialogId}"]`);
    const recipient = userId !== User.contact.id;
    const visible = $chat.is(':visible');

    if (recipient && visible) {
      // stop displays the status if they do not come
      if (clearTyping === undefined) {
        clearTyping = setTimeout(() => {
          typingList = [];
          stopShowTyping(contact.full_name);
        }, 6000);
      } else {
        clearTimeout(clearTyping);
        clearTyping = setTimeout(() => {
          typingList = [];
          stopShowTyping(contact.full_name);
        }, 6000);
      }

      if (isTyping) {
        // display start typing status
        startShowTyping(contact.full_name);
      } else {
        // stop display typing status
        stopShowTyping(contact.full_name);
      }
    }
  },

  onDeliveredStatus(messageId, dialogId) {
    self.addStatusMessages(messageId, dialogId, 'delivered', true);
    updatedMessageModel(messageId, dialogId, 'delivered');
  },

  onReadStatus(messageId, dialogId) {
    self.addStatusMessages(messageId, dialogId, 'displayed', true);
    updatedMessageModel(messageId, dialogId, 'displayed');
  },

  updateMediaElement(params) {
    const Listeners = this.app.listeners;
    const QMPlayer = self.app.QMPlayer.Model;
    let duration;

    if (params.type && params.type.indexOf('audio') > -1) {
      duration = Number.isNaN(params.duration) ? 0 : Number(params.duration);

      // eslint-disable-next-line no-new
      new QMPlayer({
        id: params.id,
        name: params.name,
        source: params.url,
        duration: toStringTime(duration),
      });

      Listeners.listenToMediaElement(`#audio_${params.id}`);
    } else if (params.type && params.type.indexOf('video') > -1) {
      Listeners.listenToMediaElement(`#video_${params.id}`);
    }

    function toStringTime(time) {
      const m = Math.floor(time / 60);
      const s = time % 60;
      const min = m < 10 ? `0${m}` : m;
      const sec = s < 10 ? `0${s}` : s;

      return `${min}:${sec}`;
    }
  },
};

/* Private
---------------------------------------------------------------------- */
function getStatus(status, html) {
  let content = html || '';

  if (!status || status.subscription === 'none') {
    content += '<span class="status status_request"></span>';
  } else if (status && status.status) {
    content += '<span class="status status_online"></span>';
  } else {
    content += '<span class="status"></span>';
  }

  return content;
}

function getFileSize(size) {
  return size > 1024 * 1024
    ? `${(size / (1024 * 1024)).toFixed(1)} MB`
    : `${(size / 1024).toFixed(1)}KB`;
}

function smartScroll() {
  if (Helpers.isBeginOfChat()) {
    $('.j-scrollbar_message:visible').mCustomScrollbar('scrollTo', 'bottom');
  }
}

function stopShowTyping(user) {
  const index = typingList.indexOf(user);

  typingList.splice(index, 1); // removing current user from typing list

  // remove typing html or that user from this html
  if (typingList.length < 1) {
    $('article.message[data-status="typing"]').remove();
  } else {
    $('article.message[data-status="typing"] .message_typing').text(typingList.join(', '));
  }

  isTypingOrAreTyping();
}

function startShowTyping(user) {
  const form = $('article.message[data-status="typing"]').length > 0;
  let html;

  // build html for typing statuses
  html = '<article class="message typing l-flexbox l-flexbox_alignstretch" data-status="typing">';
  html += '<div class="message_typing"></div>';
  html += '<div class="is_or_are"> is typing</div>';
  html += '<div class="popup-elem spinner_bounce is-typing">';
  html += '<div class="spinner_bounce-bounce1"></div>';
  html += '<div class="spinner_bounce-bounce2"></div>';
  html += '<div class="spinner_bounce-bounce3"></div>';
  html += '</div></article>';

  typingList.unshift(user); // add user's name in begining of typing list
  $.unique(typingList); // remove duplicates
  typingList.splice(3, Number.MAX_VALUE); // leave the last three users which are typing

  // add a new typing html or use existing for display users which are typing
  if (form) {
    $('article.message[data-status="typing"] .message_typing').text(typingList.join(', '));
  } else {
    $('.j-typing').append(html);
    $('article.message[data-status="typing"] .message_typing').text(typingList.join(', '));
  }

  isTypingOrAreTyping();
}

function isTypingOrAreTyping() {
  if (typingList.length > 1) {
    $('div.is_or_are').text(' are typing');
  } else {
    $('div.is_or_are').text(' is typing');
  }
}

function roomJidVerification(dialogId) {
  let roomJid = QB.chat.helpers.getRoomJidFromDialogId(dialogId);
  const arrayString = roomJid.split('');

  if (arrayString[0] === '_') {
    roomJid = QMCONFIG.qbAccount.appId + roomJid.toString();
  }

  return roomJid;
}

function createAndShowNotification(msg, isHiddenChat) {
  const { dialogs } = Entities.Collections;
  const dialog = dialogs.get(msg.dialog_id);
  const cancelNotify = !Settings.get('messages_notify');
  const isNotMainTab = !SyncTabs.get();
  const isCurrentUser = msg.sender_id === User.contact.id;

  if (cancelNotify || isNotMainTab || isCurrentUser) {
    return;
  }

  const params = {
    user: User,
    contacts: ContactList.contacts,
  };

  if (dialog) {
    params.roomName = dialog.get('room_name');
    params.roomPhoto = dialog.get('room_photo');
  }

  const title = Helpers.Notifications.getTitle(msg, params);
  const options = Helpers.Notifications.getOptions(msg, params);

  if (QBNotification.isSupported() && isHiddenChat) {
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

function getLocationFromAttachment(attachment) {
  let geodata = attachment.data;
  let geocoords;

  if (geodata) {
    geodata = geodata
      .replace(/&amp;/gi, '&')
      .replace(/&quot;/gi, '"')
      .replace(/&#10;/gi, '');
    geocoords = JSON.parse(geodata);
  } else {
    // the old way for receive geo coordinates from attachments
    geocoords = {
      lat: attachment.lat,
      lng: attachment.lng,
    };
  }

  return geocoords;
}

function syncContactRequestInfo(params) {
  const ContactListView = self.app.views.ContactList;
  const notificationType = params.notification_type;
  const dialogId = params.dialog_id;
  const recipientJid = params.recipient_jid;
  const recipientId = QB.chat.helpers.getIdFromNode(recipientJid);

  switch (notificationType) {
    case '4':
      ContactListView.sendSubscribe(recipientJid, null, dialogId);

      Helpers.log('send subscribe');
      break;

    case '5':
      ContactListView.sendConfirm(recipientJid);

      Helpers.log('send confirm');
      break;

    case '6':
      ContactListView.sendReject(recipientJid);

      Helpers.log('send reject');
      break;

    case '7':
      ContactListView.sendDelete(recipientId);

      Helpers.log('delete contact');
      break;

    default:
      break;
  }
}

function updateDialogItem(message) {
  const $dialogItem = $(`.dialog-item[data-dialog="${message.dialog_id}"]`);
  const $lastMessage = $dialogItem.find('.j-lastMessagePreview');
  const $lastTime = $dialogItem.find('.j-lastTimePreview');
  const time = Helpers.getTime(message.date_sent, true);
  const type = message.notification_type;
  let lastMessage;

  if (type) {
    if (type <= 2) {
      lastMessage = 'Notification message';
    } else {
      lastMessage = 'Contact request';
    }
  } else if (message.callType) {
    lastMessage = 'Call notification';
  } else {
    lastMessage = minEmoji(Helpers.Messages.parser(message.body));
  }

  $lastMessage.html(lastMessage);
  $lastTime.html(time);
}

function updatedMessageModel(messageId, dialogId, param) {
  const { dialogs } = Entities.Collections;
  const dialog = dialogs.get(dialogId);
  let messages;
  let message;
  let status;

  if (dialog && dialog.get('opened')) {
    messages = dialog.get('messages');
    message = messages.get(messageId);

    if (message) {
      status = param === 'delivered' ? 'Delivered' : 'Seen';

      message.set('status', status);
    }
  }
}

function makeJid(id) {
  return QB.chat.helpers.getUserJid(id, QMCONFIG.qbAccount.appId);
}

function getUrlPreview(id) {
  if (!id) {
    return;
  }

  const $message = $(`#${id}.message`).find('.message-body');
  const $hyperText = $message.find(
    'a:not(a.open_googlemaps, a.file-download, a.qm_player_download)'
  );

  if ($hyperText.length) {
    $hyperText.each(function (index) {
      const $this = $(this);
      let params;
      let $elem;

      if (index === 5) {
        return;
      }

      const url = $this.attr('href');

      if (urlCache[url] !== null && Helpers.isImageUrl(url)) {
        $elem = $this.clone().addClass('image_preview').html(`<img src="${url}" alt="picture"/>`);
      } else if (urlCache[url] !== null && Helpers.isValidUrl(url)) {
        $elem = $this.clone().addClass('og_block');

        if (urlCache[url]) {
          $elem.html(QMHtml.Messages.urlPreview(urlCache[url]));
        } else {
          Helpers.getOpenGraphInfo(
            {
              url,
              token: JSON.parse(localStorage['QM.session']).token,
            },
            (error, result) => {
              if (result && (result.ogTitle || result.ogDescription)) {
                params = {
                  title: result.ogTitle || result.ogUrl || '',
                  description: result.ogDescription || result.ogUrl || url,
                  picture: (result.ogImage && result.ogImage.url) || '',
                };

                urlCache[url] = params;
              } else {
                params = {
                  title: 'Error 404 (Not Found)',
                  description: url,
                  picture: '',
                };

                urlCache[url] = null;
              }

              $elem.html(QMHtml.Messages.urlPreview(params));
            }
          );
        }
      }

      if ($elem) {
        $message.append($elem);
      }
    });
  }
}

function setAttachSize(params) {
  let $container;

  if (!(params && params.width && params.height)) {
    return;
  }

  const width = Number(params.width);
  const height = Number(params.height);

  if (params.type && params.type.indexOf('image') > -1) {
    $container = $(`#image_${params.id}`);
  } else if (params.type && params.type.indexOf('video') > -1) {
    $container = $(`#video_${params.id}`);
  }

  if (height < 215) {
    $container.height(height);
  } else if (height > width && height > 285) {
    $container.height(285);
  }

  smartScroll();
}

export default MessageView;
