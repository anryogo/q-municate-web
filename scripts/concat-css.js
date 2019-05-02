var concat = require('concat');

var outputFile = 'app/.tmp/vendor.css';

concat([
    'app/bower_components/malihu-custom-scrollbar-plugin/jquery.mCustomScrollbar.css',
    'app/bower_components/perfect-scrollbar/css/perfect-scrollbar.min.css',
    'app/bower_components/progressbar.js/css/lib/control/progressbar.css',
    'app/bower_components/balloon-css/balloon.min.css',
    'app/vendor/emoji/css/minEmoji.css',
    'app/vendor/intl-tel-input/css/intlTelInput.css'
], outputFile);
