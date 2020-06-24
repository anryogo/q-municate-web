/*
 *
 * Q-MUNICATE custom cursor models Module
 *
 */
function Cursor() {
  const self = this;

  this.setCursorAfterElement = function (el) {
    const range = document.createRange();

    range.setStartAfter(el);
    range.setEndAfter(el);

    setRange(range);
  };

  this.setCursorToEnd = function (el) {
    const isSelectionAndRangeAvaible =
      typeof window.getSelection !== 'undefined' && typeof document.createRange !== 'undefined';
    const isTextRangeAvaible = typeof document.body.createTextRange !== 'undefined';
    let range;
    let textRange;

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
    let sel;
    let range;
    let emoji;

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
    let range;
    let sel;

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
    let sel;

    if (document.getSelection) {
      sel = window.getSelection();

      sel.removeAllRanges();
      sel.addRange(range);
    }
  }
}

export default Cursor;
