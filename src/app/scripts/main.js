import $ from 'jquery';
import QBNotification from 'web-notifications';
// the fetch polifil for IE 10+
import 'whatwg-fetch';
import QMCONFIG from 'config';
import minEmoji from 'minEmoji';
import QM from './app';
import Helpers from './helpers';
import '../styles/main.scss';

let APP;

// Application initialization
$(() => {
  // set Q-MUNICATE version
  $('.j-appVersion').html('v. 1.15.0');

  // Set the chat protocol BOSH for IE(11+)/Edge(14+) browsers
  if (Helpers.isIE11orEdge()) {
    QMCONFIG.QBconf.chatProtocol.active = 1;
  }

  $.ajaxSetup({ cache: true });

  // initialize facebook sdk
  if (FB) {
    FB.init({
      appId: QMCONFIG.fbAccount.appId,
      version: 'v3.0',
    });
  }

  // emoji smiles run
  $('.smiles-group').each(function () {
    const obj = $(this);

    obj.html(minEmoji(obj.text(), true));
  });

  if (QMCONFIG.notification && QBNotification.isSupported()) {
    QBNotification.requestPermission();
  }

  APP = new QM();
  APP.init();
});
