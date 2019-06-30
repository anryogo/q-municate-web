'use strict';

/*
 * Q-municate chat application
 *
 * FB Import Completed View
 *
 */
define([
    'jquery',
    'underscore',
    'backbone',
], (
    $,
    _,
    Backbone,
) => Backbone.View.extend({
    className: 'importWrap',

    template: _.template($('#templateFBImport').html()),

    events: {
        'click .returnBackToPopup': 'returnToPopup',
    },

    render() {
        const template = this.$el.html(this.template());

        $('.popups').append(template);
        this.delegateEvents(this.events);
        return this;
    },

    openPopup() {
        if ($('.passWrap')[0]) {
            $('.passWrap').addClass('tempHide');
        } else if ($('.profileWrap')[0]) {
            $('.profileWrap').addClass('tempHide');
        } else {
            $('.popup.is-overlay').addClass('tempHide');
        }

        $('.tempHide').hide();
        this.$el.find('.popup').add('.popups').addClass('is-overlay');
    },

    returnToPopup(event) {
        event.preventDefault();
        this.remove();
        $('.tempHide').show();
        $('.tempHide').removeClass('tempHide');
    },

}));
