'use strict';

const Configuration = (function() {
  const appConfig = {
    openInTab: false,
    deepLevel: 0,
    filterType: 'showHide',
    popupMode: false
  };
  const imgConfig = {
    filesize: {
      enabled: false,
      min: 0,
      max: 1048576
    },
    filetype: {
      allimages: true,
      jpeg: true,
      png: true,
      gif: true,
      bmp: true
    },
    dimensions: {
      enabled: false,
      minwidth: 1,
      minheight: 1,
      maxwidth: 1920,
      maxheight: 1024
    }
  };
  return {
    ImageConfig: imgConfig,
    AppConfig: appConfig
  };
})();
