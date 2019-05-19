/* global Helper */
'use strict';
const UI = {
  makeImageElement: (img, imgInfo) => {
    const galleryWrapper = document.querySelector('.gallery-wrapper');
    const figElem = document.createElement('figure');
    figElem.className = 'gallery-item';
    figElem.dataset.src = img.src;
    figElem.dataset.name = img.src.split('.').pop();
    figElem.dataset.format = imgInfo.imageType;
    figElem.dataset.size = imgInfo.imageSize;
    figElem.dataset.filename = imgInfo.filename;
    figElem.appendChild(img);

    const imageInfoElem = document.createElement('div');
    imageInfoElem.className = 'gallery-item-info';

    const formatElem = document.createElement('span');
    formatElem.className = 'gallery-item-format';
    formatElem.textContent = imgInfo.imageType;
    imageInfoElem.appendChild(formatElem);

    const sizeElem = document.createElement('span');
    sizeElem.className = 'gallery-item-size';
    sizeElem.textContent = Helper.humanReadableFileSize(imgInfo.imageSize);
    imageInfoElem.appendChild(sizeElem);

    const copyLink = document.createElement('span');
    copyLink.title = chrome.i18n.getMessage('copy_link');
    copyLink.dataset.src = img.src;
    copyLink.classList = 'icon-copy';
    figElem.appendChild(copyLink);
    figElem.appendChild(imageInfoElem);

    const openInNewTab = document.createElement('a');
    openInNewTab.href = img.src;
    openInNewTab.target = '_blank';
    openInNewTab.title = chrome.i18n.getMessage('open_in_new_tab');
    openInNewTab.classList = 'icon-link';
    figElem.appendChild(openInNewTab);
    galleryWrapper.appendChild(figElem);
    const total = document.getElementById('lblTotal');
    total.textContent = parseInt(total.textContent) + 1;
    if (parseInt(total.textContent) > 0) {
      document.getElementById('btnStartFilter').classList.remove('button-disabled');
    }
  }
};
