import CryptoJS from 'crypto-js';
import QMCONFIG from 'config';

/*
 * Q-municate chat application
 *
 * Session Module
 *
 */
function Session(app) {
  this.app = app;
}

Session.prototype = {

  create(params) {
    this.token = params.token;
    this.expirationTime = params.expirationTime || null;
    this.authParams = params.authParams;
  },

  update(params) {
    if (params.token) {
      this.token = params.token;
    } else {
      if (params.authParams) {
        this.authParams = params.authParams;
      }

      if (params.date) {
        // set QB session expiration through 5 minutes
        const { date } = params;

        date.setMinutes(date.getMinutes() + 5);
        this.expirationTime = date.toISOString();
      }

      localStorage.setItem('QM.session', JSON.stringify({
        token: this.token,
        expirationTime: this.expirationTime,
        authParams: this.authParams,
      }));
    }
  },

  destroy() {
    localStorage.removeItem('QM.session');
    this.token = null;
    this.expirationTime = null;
    this.authParams = null;
  },

  // crypto methods for password
  encrypt(params) {
    if (params && params.password) {
      params.password = CryptoJS.AES
        .encrypt(params.password, QMCONFIG.qbAccount.authSecret)
        .toString();
    }

    return params;
  },

  decrypt(params) {
    if (params && params.password) {
      params.password = CryptoJS.AES
        .decrypt(params.password, QMCONFIG.qbAccount.authSecret)
        .toString(CryptoJS.enc.Utf8);
    }

    return params;
  },

};

export default Session;
