const $ = require('jquery');
const QB = require('quickblox');

const QMCONFIG = require('config');
const Location = require('views/location');
const Entities = require('../entities');
const Helpers = require('../helpers');
const QMHtml = require('../qmhtml');

/*
 * Q-municate chat application
 *
 * User View Module
 *
 */
let User;
let ContactList;
let FBCallback = null;
let clearErrors;
let switchPage;
let switchOnWelcomePage;
let appearAnimation;

function UserView(app) {
  this.app = app;

  /* eslint-disable prefer-destructuring */
  User = this.app.models.User;
  ContactList = this.app.models.ContactList;
  /* eslint-enable prefer-destructuring */
}

UserView.prototype = {

  signupQB() {
    switchPage($('#signUpPage'));
  },

  loginQB() {
    switchPage($('#loginPage'));
  },

  forgot() {
    switchPage($('#forgotPage'));
  },

  logInFirebase(callback) {
    if (typeof callback === 'function') {
      User.reLogInFirebasePhone((authParams) => {
        callback(authParams);
      });
    } else {
      new this.app.FirebaseWidget(User.logInFirebasePhone); // eslint-disable-line no-new
    }
  },

  logInFacebook() {
    User.logInFacebook();
  },

  connectFB(token) {
    User.connectFB(token);
  },

  signupForm() {
    clearErrors();
    User.signup();
  },

  loginForm() {
    clearErrors();
    User.login();
  },

  forgotForm() {
    clearErrors();
    User.forgot();
  },

  resetForm() {
    clearErrors();
    User.resetPass();
  },

  autologin() {
    switchPage($('#loginPage'));
    User.autologin();
  },

  createSpinner() {
    $('section:visible form').addClass('is-hidden').next('.l-spinner').removeClass('is-hidden');
  },

  removeSpinner() {
    $('section:visible form').removeClass('is-hidden').next('.l-spinner').addClass('is-hidden');
  },

  successFormCallback() {
    const $profileAvatar = $('#avatar-container');

    this.removeSpinner();
    $profileAvatar.addClass('profileUserAvatar').css('background-image', `url(${User.contact.avatar_url})`);
    $profileAvatar.attr('data-id', User.contact.id);
    $profileAvatar.attr('data-name', User.contact.full_name);
    switchPage($('#mainPage'));
    this.app.views.Dialog.createDataSpinner();
  },

  successSendEmailCallback() {
    let alert = '<div class="j-success_callback note l-form l-flexbox l-flexbox_column">';
    alert += '<span class="text text_alert text_alert_success">Success!</span>';
    alert += '<span class="text">Please check your email and click a link in the letter in order to reset your password</span>';
    alert += '</div>';

    this.removeSpinner();
    $('section:visible form').addClass('is-hidden').after(alert);
  },

  getFBStatus(cb) {
    if (typeof FB === 'undefined') {
      // Wait until FB SDK will be downloaded and then calling this function again
      FBCallback = cb;
      sessionStorage.setItem('QM.is_getFBStatus', true);
      return;
    }

    const callback = cb || FBCallback;
    FBCallback = null;

    FB.getLoginStatus((response) => {
      Helpers.log('FB status response', response);
      if (callback) {
        // situation when you are recovering QB session via FB
        // and FB accessToken has expired
        if (response.status === 'connected') {
          callback(response.authResponse.accessToken);
        } else {
          FB.login((res) => {
            Helpers.log('FB authResponse', res);
            if (res.status === 'connected') callback(res.authResponse.accessToken);
          });
        }
      }
    }, true);
  },

  profilePopover(objDom) {
    const html = QMHtml.User.profilePopover();

    objDom.after(html);
    appearAnimation();
  },

  contactPopover(objDom) {
    const ids = objDom.parent().data('id');
    const dialogId = objDom.parent().data('dialog');
    const { roster } = ContactList;
    const { dialogs } = Entities.Collections;
    const dialog = dialogs.get(dialogId).toJSON();
    const htmlTpl = QMHtml.User.contactPopover({
      dialogId,
      dialogType: dialog.type,
      occupantsIds: dialog.occupants_ids,
      ids,
    }, roster[ids]);

    objDom.after(htmlTpl)
      .parent().addClass('is-contextmenu');

    appearAnimation();

    const elemPosition = objDom.offset().top;
    const list = document.querySelector('.j-scrollbar_aside');
    const topListOffset = list.offsetTop;
    const listHeigth = list.offsetHeight;
    let listViewPort = 0;
    const botListOffset = listHeigth + topListOffset;
    const dropList = objDom.next();
    const dropListElemCount = objDom.next().children().length;
    const botElemPosition = botListOffset - elemPosition;
    const elemPositionInList = elemPosition - topListOffset;

    $('.j-aside_list_item').each((index, element) => {
      listViewPort += element.offsetHeight;
    });

    if ((botElemPosition <= dropListElemCount * 50)
            && (elemPositionInList > dropListElemCount * 40)) {
      dropList.addClass('margin-up');
    }

    if (listViewPort <= 400) {
      list.style.paddingBottom = `${dropListElemCount * 40}px`;
    }
  },

  occupantPopover(objDom, e) {
    const id = objDom.data('id');
    const jid = QB.chat.helpers.getUserJid(id, QMCONFIG.qbAccount.appId);
    const { roster } = ContactList;
    const position = e.currentTarget.getBoundingClientRect();
    const htmlTpl = QMHtml.User.occupantPopover({
      id,
      jid,
    }, roster[id]);

    $('body').append(htmlTpl);

    appearAnimation();

    objDom.addClass('is-active');

    $('.list-actions_occupants').offset({
      top: (29 + position.top),
      left: position.left,
    });
  },

  buildDetails(userId) {
    const popup = $('#popupDetails');
    const contact = ContactList.contacts[userId];
    const { roster } = ContactList;
    const chatStatus = roster[userId] ? roster[userId] : null;

    if (navigator.userAgent.match(/Firefox/)) {
      popup.find('.userDetails-controls button').css('padding', '0 12px');
    }

    popup.find('.userDetails-avatar').attr('data-id', userId).css('background-image', `url(${contact.avatar_url})`);
    popup.find('.userDetails-filename').attr('data-id', userId).text(contact.full_name);

    popup.find('.userDetails-status').attr('data-id', userId).text(contact.status);

    if (chatStatus && chatStatus.status) {
      popup.find('.userDetails-chatStatus').html('<span class="status status_online"></span><span class="status_text">Online</span>');
    } else {
      popup.find('.userDetails-chatStatus').html('<span class="status"></span><span class="status_text">Offline</span>');
    }

    popup.find('.writeMessage').data('id', userId);

    popup.find('.userDetails-field').attr('data-id', userId).html(
      contact.phone
        ? `<span class="userDetails-label">Phone:</span><span class="userDetails-phone">${contact.phone}</span>`
        : '',
    );

    this.getNewProfile(userId);
  },

  getNewProfile(userId) {
    const QBApiCalls = this.app.service;
    const { Contact } = this.app.models;

    QBApiCalls.getUser(userId, (user) => {
      const contact = Contact.create(user);
      ContactList.contacts[contact.id] = contact;

      $(`.profileUserName[data-id="${contact.id}"]`).text(contact.full_name);
      $(`.profileUserStatus[data-id="${contact.id}"]`).text(contact.status);
      if (contact.phone) {
        $(`.profileUserPhone[data-id="${contact.id}"]`).html(
          `<span class="userDetails-label">Phone:</span><span class="userDetails-phone">${contact.phone}</span>`,
        );
      }
      $(`.profileUserAvatar[data-id="${contact.id}"]`).css('background-image', `url(${contact.avatar_url})`);

      localStorage.setItem(`QM.contact-${contact.id}`, JSON.stringify(contact));
    });
  },

  logout() {
    const DialogView = this.app.views.Dialog;

    $('.mediacall .btn_hangup').click();

    User.logout(() => {
      switchOnWelcomePage();
      $('.j-capBox').removeClass('is-hidden');
      $('.j-chatWrap').addClass('is-hidden');
      $('.j-popover_const').removeClass('is-active');
      $('.l-chat').remove();
      Helpers.log('current User and Session were destroyed');
      DialogView.logoutWithClearData();
    });
  },

  localSearch(form) {
    const val = form.find('input[type="search"]').val().trim().toLowerCase();
    const selected = $('#searchList li.is-selected').data('dialog');
    const $notSearchLists = $('#recentList, #historyList, #requestsList');

    if (val.length > 0) {
      $('#searchList').removeClass('is-hidden').siblings('section').addClass('is-hidden');
      $('#searchList ul').html('').add('#searchList .note').removeClass('is-hidden');

      $('#recentList, #historyList, #oldHistoryList').find('.dialog-item').each(function() {
        const name = $(this).find('.name').text().toLowerCase();
        const li = $(this).clone();

        if (name.indexOf(val) > -1) {
          $('#searchList ul').append(li);
          $('#searchList .note').addClass('is-hidden');
        }
      });

      if ($('#searchList ul').find('li').length === 0) {
        $('#searchList .note').removeClass('is-hidden').siblings('ul').addClass('is-hidden');
      }
    } else {
      $('#searchList').addClass('is-hidden');
      $notSearchLists.each(function() {
        const $this = $(this);

        if ($this.find('.list-item').length > 0) {
          $this.removeClass('is-hidden');
        }

        if (selected) {
          $this.find(`.list-item[data-dialog="${selected}"]`).addClass('is-selected');
        }
      });
      if ($('.l-list-wrap section:not(#searchList) .list-item').length === 0) {
        $('#emptyList').removeClass('is-hidden');
      }
    }
  },

  friendsSearch(form) {
    const val = form.find('input[type="search"]').val().trim().toLowerCase();
    const result = form.next();

    result.find('ul').removeClass('is-hidden').siblings().addClass('is-hidden');
    result.find('ul li').removeClass('is-hidden');

    if (val.length > 0) {
      result.find('ul li').each(function() {
        const name = $(this).find('.name').text().toLowerCase();
        const li = $(this);

        if (name.indexOf(val) === -1) {
          li.addClass('is-hidden');
        }
      });

      if (result.find('ul li:visible').length === 0) {
        result.find('.note').removeClass('is-hidden').siblings().addClass('is-hidden');
      }
    }
  },

};

/* Private
---------------------------------------------------------------------- */
clearErrors = function() {
  $('.is-error').removeClass('is-error');
};

switchPage = function(page) {
  $('body').removeClass('is-welcome');
  page.removeClass('is-hidden').siblings('section').addClass('is-hidden');

  // reset form
  clearErrors();
  $('.no-connection').addClass('is-hidden');
  page.find('input').val('');
  if (!page.is('#mainPage')) {
    page.find('form').removeClass('is-hidden').next('.l-form').remove(); // reset Forgot form after success sending of letter
    page.find('input:file').prev().find('.avatar').css('background-image', `url(${QMCONFIG.defAvatar.url})`)
      .siblings('span')
      .text(QMCONFIG.defAvatar.caption);
    page.find('input:checkbox').prop('checked', false);

    // start watch location if the option is enabled
    if (localStorage['QM.latitude'] && localStorage['QM.longitude']) {
      localStorage.removeItem('QM.latitude');
      localStorage.removeItem('QM.longitude');

      Location.toggleGeoCoordinatesToLocalStorage(true, (res, err) => {
        Helpers.log('Location: ', err || res);
      });
    }
  }
};

switchOnWelcomePage = function() {
  $('body').addClass('is-welcome');
  $('#welcomePage').removeClass('is-hidden').siblings('section').addClass('is-hidden');
};

appearAnimation = function() {
  $('.popover:not(.j-popover_const)').fadeIn(150);
};

module.exports = UserView;
