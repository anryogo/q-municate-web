var concat = require('concat');

var outputFile = 'app/.tmp/vendor.css';

concat([
    'app/vendor/malihu-custom-scrollbar-plugin/jquery.mCustomScrollbar.min.css',
    'app/vendor/perfect-scrollbar/perfect-scrollbar.min.css',
    'app/vendor/progressbar/progressbar.css',
    'app/vendor/balloon-css/balloon.min.css',
    'app/vendor/emoji/css/minEmoji.css',
    'app/vendor/intl-tel-input/css/intlTelInput.css'
], outputFile);
