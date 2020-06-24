import loadImage from 'blueimp-load-image';

/*
 * Q-municate chat application
 *
 * Attach Module
 *
 */
function Attach(app) {
  this.app = app;
}

Attach.prototype = {

  upload(file, callback) {
    const self = this;
    const QBApiCalls = self.app.service;

    QBApiCalls.createBlob({
      file,
      public: true,
    }, (blob) => {
      callback(blob);
    });
  },

  create(blob, metadata) {
    let type;

    if (blob.content_type.indexOf('image/') === 0) {
      type = 'image';
    } else if (blob.content_type.indexOf('audio/') === 0) {
      type = 'audio';
    } else if (blob.content_type.indexOf('video/') === 0) {
      type = 'video';
    } else {
      type = 'file';
    }

    return {
      type,
      id: blob.uid,
      name: blob.name,
      size: blob.size || metadata.size,
      'content-type': blob.content_type,
      duration: metadata.duration,
      height: metadata.height,
      width: metadata.width,
    };
  },

  crop(file, params, callback) {
    loadImage(
      file,
      (img) => {
        const attr = {
          crop: true,
        };

        if (img.width > img.height) {
          attr.maxWidth = params.w;
        } else {
          attr.maxHeight = params.h;
        }

        loadImage(
          file,
          (canvas) => {
            canvas.toBlob((blob) => {
              blob.name = file.name;
              callback(blob);
            }, file.type);
          },
          attr,
        );
      },
    );
  },

};

export default Attach;
