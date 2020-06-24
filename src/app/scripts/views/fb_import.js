const $ = require('jquery');
const _ = require('underscore');
const Backbone = require('backbone');

/*
 * Q-municate chat application
 *
 * FB Import Completed View
 *
 */
module.exports = Backbone.View.extend({
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

});
