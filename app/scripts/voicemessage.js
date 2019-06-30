'use strict';

/**
 * AudioRecorder
 */
define([
    'config',
    'Helpers',
    'QBMediaRecorder',
], (
    QMCONFIG,
    Helpers,
    QBMediaRecorder,
) => {
    let self;

    function VoiceMessage(app) {
        this.app = app;

        self = this;
        self.active = false;
        self.supported = false;
        self.blob = null;
        self.stream = null;
        self.timerID = undefined;

        self.ui = {
            chat: undefined,
            title: undefined,
            control: undefined,
            cancel: undefined,
            progress: undefined,
        };

        self.init();
    }

    VoiceMessage.prototype = {
        init() {
            self.supported = false;

            if (Helpers.isIE11orEdge()) return;

            if (QBMediaRecorder.isAvailable() || QBMediaRecorder.isAudioContext()) {
                self.supported = true;
                self.initRecorder();
            }
        },

        initRecorder() {
            const options = {
                onstart() {
                    self.startTimer();
                },
                onstop(blob) {
                    self.stopTimer();
                    self.blob = blob;
                },
                mimeType: 'audio/mp3',
                workerPath: '../workers/qbAudioRecorderWorker.js',
            };

            self.ui.chat = document.getElementById('workspaceWrap');
            self.ui.title = document.getElementById('recordTitle');
            self.ui.control = document.getElementById('startRecord');
            self.ui.cancel = document.getElementById('cancelRecord');
            self.ui.progress = document.getElementById('recordProgress');

            self.initHandler();

            self.recorder = new QBMediaRecorder(options);

            Helpers.log('Recorder is ready to use');
        },

        blockRecorder(message) {
            const recorders = document.getElementsByClassName('j-btn_audio_record');
            const error = message || ' (unsupported)';
            let recorder;

            if (recorders.length) {
                recorders.forEach((item) => {
                    recorder = item;

                    recorder.disabled = true;
                    recorder.classList.remove('is-active');
                    recorder.classList.add('is-unavailable');
                    recorder.setAttribute('data-balloon-length', 'medium');
                    recorder.setAttribute('data-balloon', `Recorder unavailable${error}`);
                });
            }

            Helpers.log(`Recorder unavailable${error}`);
        },

        startStream(callback) {
            navigator.mediaDevices.getUserMedia({
                audio: true,
            }).then((stream) => {
                self.stream = stream;
                callback();
            }).catch((err) => {
                self.resetRecord();
                self.blockRecorder('(microphone wasn\'t found)');
                throw err;
            });
        },

        stopStream() {
            if (!self.stream) {
                return;
            }

            self.stream.getTracks().forEach((track) => {
                track.stop();
            });
        },

        startTimer() {
            let step = 0;
            let time = 0;
            let min;
            let sec;

            self.ui.progress.classList.add('is-active');

            self.timerID = setInterval(() => {
                step += 1;

                self.ui.title.innerHTML = timerValue();

                if (step === QMCONFIG.MAX_RECORD_TIME) {
                    self.ui.control.click();
                }
            }, 1000);

            function timerValue() {
                time += 1;

                min = Math.floor(time / 60);
                min = min >= 10 ? min : `0${min}`;
                sec = Math.floor(time % 60);
                sec = sec >= 10 ? sec : `0${sec}`;

                return `${min}:${sec}`;
            }
        },

        stopTimer() {
            clearInterval(self.timerID);
            self.timerID = undefined;
        },

        initHandler() {
            self.ui.chat.addEventListener('click', (event) => {
                const { target } = event;
                const controlElClassList = self.ui.control.classList;
                const progressElClassList = self.ui.progress.classList;
                const cancelElClassList = self.ui.cancel.classList;

                // recorder's controls
                if (target === self.ui.control || target === self.ui.title) {
                    // send recorded voicemessage as attachment
                    if (controlElClassList.contains('is-send') && self.blob) {
                        self.sendRecord();
                        self.resetRecord();
                        // stop recorder and prepare to sending
                    } else if (controlElClassList.contains('is-active')) {
                        self.stopRecord();

                        progressElClassList.remove('is-active');
                        controlElClassList.remove('is-active');
                        controlElClassList.add('is-send');
                        self.ui.title.innerHTML = 'SEND';

                        self.ui.send = self.ui.title;
                        // start recorder
                    } else {
                        self.startRecord();

                        controlElClassList.remove('is-send');
                        controlElClassList.add('is-active');
                        cancelElClassList.add('is-active');

                        self.ui.title.innerHTML = '00:00';
                    }
                }

                // cancel recording
                if (target === self.ui.cancel) {
                    self.cancelRecord();

                    controlElClassList.remove('is-active');
                    controlElClassList.remove('is-send');
                    progressElClassList.remove('is-active');
                    cancelElClassList.remove('is-active');

                    self.ui.title.innerHTML = 'RECORD';
                }

                return false;
            });
        },

        toggleActiveState(bool) {
            const buttons = document.querySelectorAll('.j-footer_btn');
            const textarea = document.querySelector('.j-textarea');
            const contenteditable = !bool;
            const opacityLevel = bool ? 0.4 : 1;

            // send recording state
            self.active = bool;
            // disable footer buttons
            textarea.setAttribute('contenteditable', contenteditable);

            buttons.forEach((elem) => {
                elem.disabled = bool;
                elem.style.opacity = opacityLevel;
            });
        },

        resetRecord(dialogId) {
            if (!self.supported) {
                return;
            }

            const popover = document.getElementById('popoverRecord');
            const button = document.querySelector('.j-btn_audio_record');
            const activeDialogId = self.app.entities.active;

            if ((dialogId && (dialogId !== activeDialogId)) || !button) {
                return;
            }

            // close recorder's popover
            popover.classList.remove('is-active');
            button.classList.remove('is-active');
            button.classList.remove('is-unavailable');
            button.setAttribute('data-balloon', 'Record audio');
            button.removeAttribute('data-balloon-length');

            // reset recorder's elements to start position
            self.ui.control.classList.remove('is-send');
            self.ui.control.classList.remove('is-active');
            self.ui.progress.classList.remove('is-active');
            self.ui.cancel.classList.remove('is-active');
            self.ui.title.innerHTML = 'RECORD';

            // cancel recording and change state
            self.cancelRecord();
            self.toggleActiveState(false);
        },

        startRecord() {
            self.blob = null;
            self.startStream(() => {
                self.recorder.start(self.stream);
                self.toggleActiveState(true);
            });
        },

        stopRecord() {
            self.recorder.stop();
            self.stopStream();
            self.stream = null;
        },

        cancelRecord() {
            if (self.stream) {
                self.stopRecord();
            }
            self.blob = null;
            self.toggleActiveState(false);
        },

        sendRecord() {
            if (!self.blob) {
                return;
            }

            // prepare file from blob object
            const recordedAudioFile = new File([self.blob], 'Voice message', {
                type: self.blob.type,
                lastModified: Date.now(),
            });

            // send file as attachment
            self.app.views.Attach.changeInput(null, recordedAudioFile);

            self.blob = null;
            self.toggleActiveState(false);
        },
    };

    return VoiceMessage;
});
