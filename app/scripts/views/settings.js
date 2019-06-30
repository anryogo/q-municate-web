'use strict';

/*
 *
 * Q-MUNICATE settings views Module
 *
 */
define(['jquery'], ($) => {
    let Settings;

    function SettingsView(app) {
        this.app = app;
        Settings = this.app.models.Settings; // eslint-disable-line prefer-destructuring
    }

    SettingsView.prototype = {

        // set users settings from localStorage or create default (default - all is ON)
        setUp(userId) {
            Settings.init(userId);

            const storageSettings = JSON.parse(localStorage[`QM.settings-${userId}`]);

            // set checkbox position
            Object.keys(storageSettings).forEach((key) => {
                const $elem = $(`#${key}`);

                $elem[0].checked = storageSettings[key];
            });
        },

        // update user's settings
        update(newStatus) {
            Settings.set(newStatus);
            Settings.save();
        },

    };

    return SettingsView;
});
