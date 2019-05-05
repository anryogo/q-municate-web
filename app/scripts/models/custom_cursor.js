/*
 *
 * Q-MUNICATE custom cursor models Module
 *
 */
define([], function () {
    'use strict';

    function Cursor() {
        var self = this;

        this.setCursorAfterElement = function (el) {
            var range = document.createRange();

            range.setStartAfter(el);
            range.setEndAfter(el);

            setRange(range);
        };

        this.setCursorToEnd = function (el) {
            var isSelectionAndRangeAvaible = typeof window.getSelection !== 'undefined'
                                             && typeof document.createRange !== 'undefined';
            var isTextRangeAvaible = typeof document.body.createTextRange !== 'undefined';
            var range;
            var textRange;

            el.focus();

            if (isSelectionAndRangeAvaible) {
                range = document.createRange();

                range.selectNodeContents(el);
                range.collapse(false);
                setRange(range);
            } else if (isTextRangeAvaible) {
                textRange = document.body.createTextRange();

                textRange.moveToElementText(el);
                textRange.collapse(false);
                textRange.select();
            }
        };

        this.insertElement = function (element, newClassName) {
            var sel;
            var range;
            var emoji;

            if (window.getSelection) {
                sel = window.getSelection();

                if (sel.getRangeAt && sel.rangeCount) {
                    range = getRange();
                    emoji = element.cloneNode(true);

                    emoji.classList.add(newClassName);
                    range.insertNode(emoji);
                    self.setCursorAfterElement(emoji);
                }
            }
        };

        function getRange() {
            var range;
            var sel;

            if (document.getSelection) {
                sel = document.getSelection();

                if (sel.rangeCount > 0) {
                    range = sel.getRangeAt(0);
                }
            } else {
                range = false;
            }

            return range;
        }

        function setRange(range) {
            var sel;

            if (document.getSelection) {
                sel = window.getSelection();

                sel.removeAllRanges();
                sel.addRange(range);
            }
        }
    }

    return Cursor;
});
