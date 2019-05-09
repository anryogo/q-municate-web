/*
 * Q-municate chat application
 *
 * Profile View
 *
 */
define([
    'jquery',
    'underscore',
    'backbone',
    'config',
    'Helpers'
], function(
    $,
    _,
    Backbone,
    QMCONFIG,
    Helpers
) {
    return Backbone.View.extend({
        className: 'profileWrap',

        template: _.template($('#templateProfile').html()),

        events: {
            click: 'editProfile',
            'change .btn_userProfile_file': 'chooseAvatar'
        },

        initialize: function() {
            this.listenTo(this.model, 'invalid', this.validateError.bind(this));
        },

        render: function() {
            var renderObj = this.model.toJSON();
            var template;

            if (renderObj.phone && (renderObj.full_name === 'Unknown user')) {
                renderObj.full_name = renderObj.phone;
            }

            template = this.$el.html(this.template(renderObj));
            $('.popups').append(template);
            this.delegateEvents(this.events);

            return this;
        },

        openPopup: function() {
            this.$el.find('.popup').add('.popups').addClass('is-overlay');
        },

        closePopup: function() {
            $('.is-overlay:not(.chat-occupants-wrap)').removeClass('is-overlay');
        },

        editProfile: function(event) {
            var obj = $(event.target);
            var isError;
            var params;

            if (obj.is('.' + this.className)) {
                isError = this.$el.find('.userProfile-errors').text().trim();

                if (isError) {
                    this.remove();
                    this.closePopup();
                }

                params = {
                    full_name: this.$el.find('.userProfile-filename').val().trim(),
                    status: this.$el.find('.userProfile-status-field').val().trim(),
                    avatar: this.$el.find('.btn_userProfile_file')[0].files[0] || null
                };

                this.model.set(params, {
                    validate: true
                });

                if (!this.model.validationError) {
                    this.model.update();
                    this.remove();
                    this.closePopup();
                }

                Helpers.log(this.model);
            }
        },

        validateError: function(model, error) {
            this.$el.find('.userProfile-errors').text(error);
            this.$el.find('.userProfile-success').text('');
        },

        chooseAvatar: function() {
            var URL = window.URL;
            var avatar = this.$el.find('.btn_userProfile_file')[0].files[0];
            var src;

            if (avatar) {
                src = URL.createObjectURL(avatar);
            } else if (this.model.get('avatar_url') === QMCONFIG.defAvatar.url) {
                src = QMCONFIG.defAvatar.url;
            } else {
                src = this.model.get('avatar_url');
            }

            this.$el.find('.userDetails-avatar').css('background-image', 'url(' + src + ')');
        },

        addFBAccount: function(fbId) {
            var self = this;

            this.model.connectFB(fbId, function(err) {
                if (err) {
                    self.validateError(self.model, QMCONFIG.errors.FBAccountExists);
                    self.$el.find('.btn_userProfile_connect').prop('disabled', false);
                } else {
                    self.$el.find('.userProfile-field-facebook').html(
                        '<span class="userDetails-label">Facebook:</span><span class="userProfile-facebook">Connected</span>'
                    );
                    self.$el.find('.userProfile-errors, .userProfile-success').text('');
                }
            });
        }
    });
});
