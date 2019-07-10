'use strict';

const $ = require('jquery');
const _ = require('underscore');
const Backbone = require('backbone');

const QMCONFIG = require('config');
const Helpers = require('../helpers');

/*
 * Q-municate chat application
 *
 * Change Password View
 *
 */
module.exports = Backbone.View.extend({
    className: 'passWrap',

    template: _.template($('#templateChangePass').html()),

    events: {
        click: 'cancelChange',
    },

    initialize() {
        this.listenTo(this.model, 'invalid', this.validateError.bind(this));
    },

    render() {
        const template = this.$el.html(this.template(this.model.toJSON()));
        $('.popups').append(template);
        this.delegateEvents(this.events);
        return this;
    },

    openPopup() {
        this.$el.find('.popup').add('.popups').addClass('is-overlay');
    },

    validateError(model, error) {
        if (error === "Fields mustn't be empty"
                || error === QMCONFIG.errors.oldPass
                || error === QMCONFIG.errors.invalidPass
                || error === QMCONFIG.errors.shortPass) {
            model.set('password', '');
            this.remove();
            this.render().openPopup();
            this.$el.find('.changePass-errors').text(error);
        }
    },

    cancelChange(event) {
        const obj = $(event.target);

        if (obj.is(`.${this.className}`)) {
            this.remove();
            $('.profileWrap .userProfile-errors, .profileWrap .userProfile-success').text('');
            $('.profileWrap').show();
        }
    },

    submitForm() {
        this.$el.find('.btn_popup_changepass').hide();
        this.createDataSpinner();
        this.changePass();
    },

    createDataSpinner() {
        let spinnerBlock = '<div class="popup-elem spinner_bounce spinner_bounce_changepass">';
        spinnerBlock += '<div class="spinner_bounce-bounce1"></div>';
        spinnerBlock += '<div class="spinner_bounce-bounce2"></div>';
        spinnerBlock += '<div class="spinner_bounce-bounce3"></div>';
        spinnerBlock += '</div>';

        this.$el.find('.popup-footer').append(spinnerBlock);
    },

    removeDataSpinner() {
        this.$el.find('.spinner_bounce').remove();
        this.$el.find('.btn_popup_changepass').show();
    },

    changePass() {
        const self = this;
        const params = {
            oldPass: this.$el.find('#old-password').val().trim(),
            newPass: this.$el.find('#new-password').val().trim(),
        };

        if (!params.oldPass || !params.newPass) {
            this.validateError(this.model, "Fields mustn't be empty");
        } else {
            this.model.set({
                password: params.newPass,
            }, {
                validate: true,
            });
            Helpers.log(this.model);
            if (!this.model.validationError) {
                this.model.changeQBPass(params, (err) => {
                    if (err) {
                        self.validateError(self.model, QMCONFIG.errors.oldPass);
                    } else {
                        self.remove();
                        $('.profileWrap .userProfile-errors').text('');
                        $('.profileWrap .userProfile-success').text('Your password has been successfully changed');
                        $('.profileWrap').show();
                    }
                });
            }
        }
    },
});
