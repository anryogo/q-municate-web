'use strict';

const concat = require('concat'); // eslint-disable-line

const outputFile = 'app/.tmp/vendor.css';

concat([
    'node_modules/malihu-custom-scrollbar-plugin/jquery.mCustomScrollbar.css',
    'node_modules/perfect-scrollbar/dist/css/perfect-scrollbar.min.css',
    'node_modules/balloon-css/balloon.min.css',
    'app/vendor/emoji/css/minEmoji.css',
    'app/vendor/intl-tel-input/css/intlTelInput.css',
    'app/vendor/progressbar/progressbar.css',
], outputFile);
