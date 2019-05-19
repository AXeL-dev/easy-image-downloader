'use strict';

const Helper = {
  humanReadableFileSize: bytes => {
    bytes = parseInt(bytes);
    const thresh = 1024;
    if (Math.abs(bytes) < thresh) {
      return bytes.toFixed(2) + ' B';
    }
    let units = [];
    units = ['KB', 'MB'];
    let u = -1;
    do {
      bytes /= thresh;
      ++u;
    } while (Math.abs(bytes) >= thresh && u < units.length - 1);
    return bytes.toFixed(1) + ' ' + units[u];
  }
};
