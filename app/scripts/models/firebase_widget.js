/**
 * QMPlayer
 */
define([
    'underscore',
    'backbone',
    'config',
    'Helpers',
    'initTelInput',
    'intlTelInputUtils',
    'Events'
], function(
    _,
    Backbone,
    QMCONFIG,
    Helpers,
    initTelInput,
    intlTelInputUtils,
    Events
) {
    'use strict';

    var widget;

    var FirebaseWidget = function(login) {
        FirebaseWidget.init();

        widget = this;
        widget.login = login;
        widget.container = $('#firebase_container');
        widget.resendTime = 30;
        widget.countryCode = '';
        widget.phoneNumber = '';
        widget.fullPhoneNumber = '';
        widget.states = {};

        Object.defineProperty(widget, 'filled', {
            set: function(prop) {
                widget.states.filled = prop;
                widget.setDisableState();
            }
        });

        Object.defineProperty(widget, 'verified', {
            set: function(prop) {
                widget.states.verified = prop;
                widget.setDisableState();
            }
        });

        widget.firebasePhoneNumberForm();
    };

    FirebaseWidget.init = function() {
        if (!FirebaseWidget.started) {
            FirebaseWidget.started = true;
            firebase.initializeApp(QMCONFIG.firebase);
        }
    };

    FirebaseWidget.prototype.sendSMS = function() {
        firebase.auth()
            .signInWithPhoneNumber(widget.fullPhoneNumber, widget.recaptchaVerifier)
            .then(function(confirmationResult) {
                widget.firebaseDigitsNumberForm();
                widget.confirmationResult = confirmationResult;
            }).catch(function(error) {
                Helpers.log('Error:', error);
                if (error.message) throw error.message;
            });
    };

    FirebaseWidget.prototype.confirmPhone = function(code) {
        widget.confirmationResult.confirm(code)
            .then(function(result) {
                widget.closeWidget();
                widget.login(result.user);
            }).catch(function(error) {
                Helpers.log('Error:', error);
                if (error.message) throw error.message;
            });
    };

    FirebaseWidget.prototype.firebasePhoneNumberForm = Backbone.View.extend({
        tagName: 'form',
        className: 'firebase__form j-phone_number',
        template: _.template($('#firebasePhoneNumberForm').html()),

        events: {
            submit: 'submitAction',
            reset: 'cancelAction',
            input: 'validateAction'
        },

        initialize: function() {
            this.render();
            this.addTelInput();
            this.addRecaptcha();
        },

        render: function() {
            this.$el.html(this.template());
            widget.phoneNumberForm = this.$el;
            widget.container.append(this.$el);
            widget.currentSubmitButton = this.$el.find('.j-firebase__button_verify');

            return this;
        },

        submitAction: function(event) {
            var $input = $('#firebase__phone_number_input');

            event.preventDefault();

            // widget.fullPhoneNumber === widget.countryCode + widget.phoneNumber
            widget.phoneNumber = $input.val();
            widget.fullPhoneNumber = $input.intlTelInput('getNumber');

            if (widget.fullPhoneNumber) widget.sendSMS();
        },

        cancelAction: function(event) {
            event.preventDefault();
            widget.closeWidget();
        },

        validateAction: function(event) {
            event.preventDefault();
            widget.filled = !!event.target.value;
        },

        addTelInput: function() {
            var $input = $('#firebase__phone_number_input');

            $input.intlTelInput({
                initialCountry: widget.countryCode || 'auto',
                geoIpLookup: function(callback) {
                    if (widget.countryCode) {
                        callback(widget.countryCode);
                    } else {
                        $.get('https://ipinfo.io', function() {}, 'jsonp').always(function(resp) {
                            widget.countryCode = (resp && resp.country) ? resp.country : '';
                            callback(widget.countryCode);
                        });
                    }
                }
            });

            $input.attr('autocomplete', 'on');
            $input.val(widget.phoneNumber);
        },

        addRecaptcha: function() {
            widget.recaptchaBuilder('firebase__recaptcha_container', 'normal');
            widget.recaptchaVerifier.render();
        }
    });

    FirebaseWidget.prototype.firebaseDigitsNumberForm = Backbone.View.extend({
        tagName: 'form',
        className: 'firebase__form j-digits_number',
        template: _.template($('#firebaseDigitsNumberForm').html()),

        events: {
            submit: 'submitAction',
            reset: 'cancelAction',
            input: 'validateAction',
            'click .j-firebase__resend': 'resendCode'
        },

        initialize: function() {
            this.render();
        },

        render: function() {
            this.$el.html(this.template({ fullPhoneNumber: widget.fullPhoneNumber }));
            widget.digitsNumberForm = this.$el;
            widget.container.append(this.$el);
            widget.currentSubmitButton = this.$el.find('.j-firebase__button_verify');
            Events.intiAuthorizationInputs(this.$el.find('#firebase__code_input'));
            this.resendTimer(widget.resendTime);

            return this;
        },

        submitAction: function(event) {
            event.preventDefault();
            widget.confirmPhone($('#firebase__code_input').val());
        },

        cancelAction: function(event) {
            event.preventDefault();
            widget.closeWidget();
        },

        validateAction: function(event) {
            event.preventDefault();
            widget.filled = !!event.target.value;
        },

        resendCode: function(event) {
            event.preventDefault();
            $('.j-firebase__resend').hide();
            widget.sendSMS();
        },

        resendTimer: function(timeLeft) {
            var self = this;
            var $text = $('.j-firebase__timer_text');
            var $timer = $('.j-firebase__resend_time');
            var $button = $('.j-firebase__resend');
            if (widget.resendTime === timeLeft) {
                $button.hide();
                $text.show();
            }
            if (timeLeft < 0) {
                $text.hide();
                $button.show();
                widget.recaptchaBuilder('resend_btn', 'invisible');
            } else if (timeLeft < 10) {
                $timer.html('0' + timeLeft);
                next();
            } else {
                $timer.html(timeLeft);
                next();
            }

            function next() {
                setTimeout(function() {
                    timeLeft -= 1; // eslint-disable-line no-param-reassign
                    self.resendTimer(timeLeft);
                }, 1000);
            }
        }
    });

    FirebaseWidget.prototype.firebasePhoneNumberForm = function() {
        widget.closeWidget();
        widget.show();
        new widget.firebasePhoneNumberForm(); // eslint-disable-line no-new, new-cap
    };

    FirebaseWidget.prototype.firebaseDigitsNumberForm = function() {
        widget.closeWidget();
        widget.show();
        new widget.firebaseDigitsNumberForm(); // eslint-disable-line no-new, new-cap
    };

    FirebaseWidget.prototype.closeWidget = function() {
        widget.cleanup();
        widget.hide();
    };

    FirebaseWidget.prototype.show = function() {
        widget.container.css('visibility', 'visible');
    };

    FirebaseWidget.prototype.hide = function() {
        widget.container.css('visibility', 'hidden');
    };

    FirebaseWidget.prototype.cleanup = function() {
        if (widget.phoneNumberForm) {
            widget.phoneNumberForm.remove();
            widget.phoneNumberForm = null;
        }

        if (widget.digitsNumberForm) {
            widget.digitsNumberForm.remove();
            widget.digitsNumberForm = null;
        }

        widget.recaptchaVerifier = null;
        widget.recaptchaWidgetId = null;
        widget.confirmationResult = null;
    };

    FirebaseWidget.prototype.recaptchaBuilder = function(target, size) {
        widget.recaptchaVerifier = new firebase.auth.RecaptchaVerifier(target, {
            size: size,
            callback: function() {
                widget.verified = true;
            },
            'expired-callback': function() {
                widget.verified = false;
            }
        });
    };

    FirebaseWidget.prototype.setDisableState = function() {
        var verified = widget.states.verified;
        var filled = widget.states.filled;
        var button = widget.currentSubmitButton;

        if (verified && filled) {
            disableButton(false);
        } else {
            disableButton(true);
        }

        function disableButton(newState) {
            var currentState = button.attr('disabled');

            if (currentState === newState) {
                return;
            }

            button.attr('disabled', newState);
        }
    };


    return FirebaseWidget;
});
