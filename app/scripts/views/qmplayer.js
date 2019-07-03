'use strict';

const _ = require('underscore');
const Backbone = require('backbone');

/**
 * QMPlayer
 */
const QMPlayer = {};

QMPlayer.Model = Backbone.Model.extend({
    defaults: {
        id: '',
        name: '',
        source: '',
        duration: '',
    },

    initialize() {
        this.buildView();
    },

    buildView() {
        new QMPlayer.View({ model: this }); // eslint-disable-line no-new
    },
});

QMPlayer.View = Backbone.View.extend({
    tagName: 'div',
    className: 'qm_audio_player',
    template: _.template(document.querySelector('#QMPlayer').innerHTML),

    initialize() {
        const id = this.model.get('id');

        this.render(id);
        this.start(id);
    },

    render(id) {
        const qmplayerTpl = this.template(this.model.toJSON());

        this.el.innerHTML = qmplayerTpl;
        document.querySelector(`#audio_player_${id}`).innerHTML = qmplayerTpl;

        return this;
    },

    start(id) {
        QMPlayer.init(id);
    },
});

QMPlayer.init = function(id) {
    const audioEl = document.querySelector(`#audio_${id}`);
    const controlEl = document.querySelector(`#qm_player_control_${id}`);
    const setterEl = document.querySelector(`#qm_player_setter_${id}`);
    const progressEl = document.querySelector(`#qm_player_progress_${id}`);
    const timeEl = document.querySelector(`#qm_player_time_${id}`);
    const fullLength = document.querySelector(`#qm_player_wrap_${id}`).offsetWidth;
    let durationTime;

    setterEl.onclick = function(e) {
        audioEl.currentTime = audioEl.duration * (e.offsetX / fullLength);
    };

    controlEl.onclick = function() {
        if (this.classList.contains('is-paused')) {
            audioEl.play();
            controlEl.classList.add('is-playing');
            controlEl.classList.remove('is-paused');
        } else {
            audioEl.pause();
        }
    };

    audioEl.onended = function() {
        audioEl.pause();
    };

    audioEl.onpause = function() {
        controlEl.classList.add('is-paused');
        controlEl.classList.remove('is-playing');
    };

    audioEl.oncanplay = function() {
        durationTime = setTime(audioEl.duration);
        timeEl.innerHTML = `00:00 / ${durationTime}`;
    };

    audioEl.ontimeupdate = function() {
        const currentTime = setTime(audioEl.currentTime);
        const length = Math.round(fullLength * (audioEl.currentTime / audioEl.duration));

        timeEl.innerHTML = `${currentTime} / ${durationTime}`;

        progressEl.style.width = `${length}px`;
    };

    function setTime(time) {
        let min;
        let sec;

        min = Math.floor(time / 60);
        min = min >= 10 ? min : `0${min}`;
        sec = Math.floor(time % 60);
        sec = sec >= 10 ? sec : `0${sec}`;

        return (`${min}:${sec}`);
    }
};

module.exports = QMPlayer;
