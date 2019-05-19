'use strict';

const ImageDownloader = {
  getOriginalImage: (url, callback) => {
    const img = new Image();
    img.src = url;
    img.onload = function() {
      callback(img);
    };
    img.onerror = function() {
      callback(img);
    };
  },
  getHeaderInfo: (url, callback) => {
    const request = new XMLHttpRequest();
    request.open('HEAD', url);
    request.timeout = 10000;
    request.onreadystatechange = function() {
      if (this.readyState === 4 && this.status === 200) {
        try {
          const typeHeader =
            request.getResponseHeader('content-type').split('/')[1];
          if (typeHeader.indexOf('html') > -1) {
            callback({state: 'success'});
            return;
          }
          if (request.getResponseHeader('content-type').indexOf('image') > - 1) {
            const imageSize = request.getResponseHeader('content-length');
            const imageType = typeHeader;
            callback({state: 'success',
              imageSize: imageSize,
              imageType: imageType,
              fullUrl: url,
              filename: ImageDownloader.getFilenameFromUrl(url)});
          }
          else {
            callback({state: 'error'});
          }
        }
        catch (e) {
          callback({state: 'error'});
        }
      }
      if (this.status !== 200) {
        callback({state: 'error'});
      }
    };
    request.onerror = function() {
      callback({state: 'error'});
    };
    request.send();
  },
  extractHostname: url => {
    const link = new URL(url);
    return link.hostname;
  },
  getFilenameFromUrl: url => {
    let filename = url.substring(url.lastIndexOf('/') + 1);
    filename = filename.substring(0, filename.lastIndexOf('.'));
    return filename;
  },
  extractProtocol: url => {
    const link = new URL(url);
    return link.protocol;
  },
  extractPort: url => {
    const link = new URL(url);
    return link.port;
  },
  findAllBackgroundStyles: (host, htmlText) => {
    const result = htmlText.match(/url\s*\(.*\)/ig);
    if (result !== null) {
      for (let i = 0; i < result.length; i++) {
        result[i] = result[i].substring(result[i].indexOf('(') + 1,
          result[i].indexOf(')'));
        result[i] = result[i].replace(/&quot;/g, '');
        if (result[i][0] === '/' && result[i].indexOf('//') > -1) {
          result[i] = result[i].substring(1);
        }
        if (result[i][0] === '/') {
          result[i] = host + result[i];
        }
        if (result[i].indexOf('base64') === -1) {
          result[i] = ImageDownloader.getCorrectUrl(host, result[i]);
        }
        result[i] = result[i].replace("'",'').replace("'",'');
      }
      return result;
    }
  },
  getStyleSheetBackgrounds: (styleSheetUrl, styleSheetContent, callback) => {
    const backgrounds = styleSheetContent.match(/url\s*\(.*\)/ig);
    if (backgrounds !== null) {
      let backgroundUrls = [];
      for (let i = 0; i < backgrounds.length; i++) {
        backgrounds[i] = backgrounds[i].substring(backgrounds[i].indexOf('(') + 1, backgrounds[i].indexOf(')'));
        backgroundUrls.push(ImageDownloader.getCorrectUrl(styleSheetUrl, backgrounds[i]));
      }
      backgroundUrls = ImageDownloader.removeUnrelatedUrl(backgroundUrls);
      callback(backgroundUrls);
    }
  },
  removeUnrelatedUrl: backgrounds => {
    return backgrounds.filter(p => !ImageDownloader.isUrlUnrelated(p));
  },
  isUrlUnrelated: url => {
    const unrelatedTags = ['.woff', '.woff2', '.ttf', '.eot', '.js'];
    for (let i = 0; i < unrelatedTags.length; i++) {
      if (url.indexOf(unrelatedTags[i]) > -1) {
        return true;
      }
    }
  },
  getCorrectUrl: (styleSheetUrl, urlPath) => {
    const url = styleSheetUrl.substring(0, styleSheetUrl.lastIndexOf('/') + 1);
    const resultUrl = url + urlPath;
    return resultUrl;
  }
};
