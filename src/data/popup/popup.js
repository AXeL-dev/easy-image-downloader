/* global Configuration, ImageDownloader, UI, JSZipUtils, JSZip */
'use strict';
let data = [];
let cache = [];
let globalHtmlText;
let downloadState = false;
let fetchPointer = -1;
let deepLevelDec = 0;
let baseDeepLevel = 0;
let deepLinks = [];
let deepLinksPointer = 0;
let intervalId = null;
let isFinishProcess = false;
let tabList = [];
let tabCounter = 0;
let tabTitle = null;

document.addEventListener('DOMContentLoaded', () => {
  loadCurrentLocale();
  chrome.storage.local.get({'ImageConfig': Configuration.ImageConfig}, result => {
    Configuration.ImageConfig = result.ImageConfig;
    initalizeFilterForm();
  });
  chrome.storage.local.get({'AppConfig': Configuration.AppConfig, 'popupMode': false}, result => {
    Configuration.AppConfig = result.AppConfig;
    document.getElementById('deepLevelInput').value = Configuration.AppConfig.deepLevel;
    document.getElementById('filterMode').querySelector('[value ="' + Configuration.AppConfig.filterType + '"]').checked = true;

    const url = window.location.href;
    const urlParam = new URL(url).searchParams;
    const activeTab = urlParam.get('tabId');
    if (activeTab !== null || result.popupMode === true) {
      if (activeTab !== null) {
        chrome.runtime.sendMessage({action: 'injectContentScript', tabId: activeTab}, responseObj => {
          startProcess(responseObj);
        });
        tabList.push(activeTab);
        tabCounter++;
        chrome.tabs.get(parseInt(activeTab), tab => {
          tabTitle = document.title = tab.title;
          showProcessingTabUrl(tab.url);
        });
      }
      else {
        chrome.tabs.query({active: true}, tab => {
          chrome.runtime.sendMessage({action: 'injectContentScript', tabId: tab[0].id}, responseObj => {
            startProcess(responseObj);
          });
          tabList.push(tab[0].id);
          tabCounter++;
          chrome.tabs.get(parseInt(tab[0].id), cTab => {
            tabTitle = document.title = cTab.title;
            showProcessingTabUrl(cTab.url);
          });
        });
      }
    }
    else {
      const targetUrl = urlParam.get('url');
      if (targetUrl !== null) {
        showProcessingTabUrl(targetUrl);
        getHtmlPages(targetUrl).then(htmlResults => {
          const parsedElements = parseLinksFromHtml(htmlResults.url, htmlResults.html);
          globalHtmlText = htmlResults.html.documentElement.innerHTML;
          deepLevelDec = Configuration.AppConfig.deepLevel.toString();
          if (parseInt(deepLevelDec) > 1) {
            const links = parsedElements.linksText;
            links.forEach(p => {
              deepLinks.push(p);
            });
            clearInterval(intervalId);
            intervalId = setInterval(function() {
              loadingProcess();
            }, 1000);
            getDeepLinks(links).then(newLinks => {
              if (deepLevelDec === 1) {
                startInnerProcess(parsedElements);
              }
              else {
                getDeepLinks(newLinks).then(newLinks2 => {
                  if (deepLevelDec === 1) {
                    startInnerProcess(parsedElements);
                  }
                  else {
                    getDeepLinks(newLinks2).then(() => {
                      if (deepLevelDec === 1) {
                        startInnerProcess(parsedElements);
                      }
                    }).catch(promisErr => {
                      console.log(promisErr);
                    });
                  }
                }).catch(promisErr => {
                  console.log(promisErr);
                });
              }
            }).catch(promisErr => {
              console.log(promisErr);
            });
          }
          gettingData(parsedElements.url,
            parsedElements.styleSheetsText, parsedElements.imgTagsSrcText, parsedElements.linksText).then(() => {
            removeEmptyURLs();
            removeDuplicateURLs();
            loadingProcess();
          });
        }).catch(promisErr => {
          console.log(promisErr);
        });
      }
      else {
        tabTitle = document.title = chrome.i18n.getMessage('all_tabs');
        chrome.storage.local.get('imageTab', result => {
          const imgTabId = result.imageTab;
          chrome.tabs.query({}, tabs => {
            tabs.forEach(tab => {
              if (tab.id !== imgTabId && tab.url.indexOf('http') > -1 ) {
                tabList.push(tab.id);
              }
            });
            chrome.runtime.sendMessage({action: 'injectContentScript', tabId: tabList[tabCounter]}, responseAllTab => {
              startProcess(responseAllTab);
            });
            chrome.tabs.get(parseInt(tabList[tabCounter]), tab => {
              showProcessingTabUrl(tab.url);
            });
            tabCounter++;
          });
        });
      }
    }
  });
});

document.addEventListener('click', e => {
  const downloadProgressWrapper = document.getElementById('downloadProgressWrapper');
  const lblDownloadProgress = document.getElementById('lblDownloadProgress');
  const downloadProgressBar = document.getElementById('downloadProgressBar');
  let downloadProgressPercent = 0;

  switch (e.target.id) {
    case 'btnStop':
      e.target.classList.add('button-disabled');
      document.getElementById('hdfCancelFlag').value = 'true';
      if (intervalId !== null) {
        clearInterval(intervalId);
        fetchPointer = 99999999999999;
        initalizeCancelProcess();
      }
      break;
    case 'btnStartFilter':
      startFilter();
      break;
    case 'btnDeselect':
      unselectAll();
      break;
    case 'btnSelectAll':
      selectAll();
      break;
    case 'btnDownload':
      downloadProgressWrapper.style.display = 'flex';
      if (downloadState === true) {
        downloadState = false;
        downloadProgressWrapper.style.display = 'none';
      }
      else {
        let selectedImages = document.querySelectorAll('.gallery-item-selected');
        selectedImages = [...selectedImages].filter(p => p.style.display !== 'none');
        selectedImages = selectedImages.map(p => {
          return {src: p.dataset.src, name: p.dataset.name, filename: p.dataset.filename, format: p.dataset.format};
        });
        const zip = new JSZip();
        let counter = 0;
        selectedImages.forEach(p => {
          JSZipUtils.getBinaryContent(p.src, function(err, data) {
            counter++;
            downloadProgressPercent = Math.round((counter / (selectedImages.length)) * 100);
            lblDownloadProgress.textContent = downloadProgressPercent + '%';
            downloadProgressBar.style.width = downloadProgressPercent + '%';

            if (err) {
              throw err; // or handle the error
            }
            zip.file((p.filename === '' ? new Date().getTime() : p.filename) + '.' + p.format, data, {binary: true});
            if (counter === selectedImages.length) {
              zip.generateAsync({type: 'blob'}).then(function(blob) {
                let target = e.target;
                target.href = URL.createObjectURL(blob);
                target.download = tabTitle + '.zip';
                downloadState = true;
                target.click();
                target.removeAttribute('href');
              }, function(err) {
                throw err;
              }).catch(promisErr => {
                console.log(promisErr);
              });
            }
          });
        });
      }
      break;
  }

  if (e.target.classList.contains('gallery-item')) {
    if (!e.target.classList.contains('gallery-item-selected')) {
      e.target.classList.add('gallery-item-selected');
    }
    else {
      e.target.classList.remove('gallery-item-selected');
    }
    selectionChangedUI();
  }

  if (e.target.className === 'icon-copy') {
    let copyFrom = document.createElement('textarea');
    copyFrom.textContent = e.target.dataset.src;
    document.body.appendChild(copyFrom);
    copyFrom.select();
    document.execCommand('copy');
    copyFrom.remove();
  }
});

// locales
[...document.querySelectorAll('[data-i18n]')].forEach(e => {
  const value = e.dataset.i18nValue || 'textContent';
  e[value] = chrome.i18n.getMessage(e.dataset.i18n);
});

/**
 * load locale
 */
function loadCurrentLocale() {
  const allImages = document.createTextNode(chrome.i18n.getMessage('allImages'));
  const jpg = document.createTextNode(chrome.i18n.getMessage('jpg'));
  const gif = document.createTextNode(chrome.i18n.getMessage('gif'));
  const bmp = document.createTextNode(chrome.i18n.getMessage('bmp'));
  const png = document.createTextNode(chrome.i18n.getMessage('png'));
  const webp = document.createTextNode(chrome.i18n.getMessage('webp'));
  const filterSelection = document.createTextNode(chrome.i18n.getMessage('filter_selection'));
  const filterShowHide = document.createTextNode(chrome.i18n.getMessage('filter_showHide'));

  document.querySelector('label[data-text="allImages"]').appendChild(allImages);
  document.querySelector('label[data-text="jpg"]').appendChild(jpg);
  document.querySelector('label[data-text="gif"]').appendChild(gif);
  document.querySelector('label[data-text="bmp"]').appendChild(bmp);
  document.querySelector('label[data-text="png"]').appendChild(png);
  document.querySelector('label[data-text="webp"]').appendChild(webp);
  document.querySelector('label[data-text="filterSelection"]').appendChild(filterSelection);
  document.querySelector('label[data-text="filterShowHide"]').appendChild(filterShowHide);
}

document.getElementById('filetypeallimageselem').addEventListener('change', e => {
  const checked = [...document.querySelectorAll('input[type="checkbox"]')].filter(p => p.id.indexOf('filetype') > -1 && p.id !== e.target.id);
  checked.forEach(p => {
    if (e.target.checked === true) {
      p.setAttribute('disabled', 'true');
      p.checked = true;
      Configuration.ImageConfig.filetype[p.dataset.chkFormat] = true;
    }
    else {
      p.removeAttribute('disabled');
      Configuration.ImageConfig.filetype[p.dataset.chkFormat] = false;
    }
  });
});

/**
 * start filter process
 */
function startFilter() {
  setConfiguration();
  chrome.storage.local.set({'ImageConfig': Configuration.ImageConfig});
  const chkEnableFileSizeFilter = document.getElementById('chkEnableFileSizeFilter');
  const chkEnableFileDimensionFilter = document.getElementById('chkEnableFileDimensionFilter');
  const dimensionsminwidthelem = document.getElementById('dimensionsminwidthelem');
  const dimensionsmaxwidthelem = document.getElementById('dimensionsmaxwidthelem');
  const dimensionsminheightelem = document.getElementById('dimensionsminheightelem');
  const dimensionsmaxheightelem = document.getElementById('dimensionsmaxheightelem');
  const fileTypeConfig = Configuration.ImageConfig.filetype;
  cache.forEach(p => {
    const predicate = () => {
      return (fileTypeConfig[p.responseHeaderInfo.imageType] === true &&
      ((chkEnableFileSizeFilter.checked === true ?
        (Configuration.ImageConfig.filesize.min <= parseInt(p.responseHeaderInfo.imageSize) &&
      Configuration.ImageConfig.filesize.max >= parseInt(p.responseHeaderInfo.imageSize)) : true)) &&
      (chkEnableFileDimensionFilter.checked === true ?
        ((parseInt(p.responseHeaderInfo.width) >= parseInt(dimensionsminwidthelem.value) &&
      parseInt(p.responseHeaderInfo.width) <= parseInt(dimensionsmaxwidthelem.value)) &&
      (parseInt(p.responseHeaderInfo.height) >= parseInt(dimensionsminheightelem.value) &&
      parseInt(p.responseHeaderInfo.height) <= parseInt(dimensionsmaxheightelem.value))) : true));
    };
    if (Configuration.AppConfig.filterType === 'showHide') {
      p.image.parentNode.style.display = predicate() ? 'flex' : 'none';
    }
    else {
      if (predicate()) {
        p.image.closest('.gallery-item').classList.add('gallery-item-selected');
      }
      else {
        p.image.closest('.gallery-item').classList.remove('gallery-item-selected');
      }
      selectionChangedUI();
    }
  });
}

/**
 * initialize configuration
 */
function setConfiguration() {
  for (let property in Configuration.ImageConfig) {
    if (Configuration.ImageConfig.hasOwnProperty(property)) {
      for (let nestedProp in Configuration.ImageConfig[property]) {
        if (Configuration.ImageConfig[property].hasOwnProperty(nestedProp)) {
          if (property === 'filetype') {
            Configuration.ImageConfig[property][nestedProp] = document.getElementById(property + nestedProp + 'elem').checked;
          }
          else if (property === 'filesize') {
            if (nestedProp !== 'enabled') {
              Configuration.ImageConfig[property][nestedProp] = parseInt(document.getElementById(property + nestedProp + 'elem').value) * 1024;
            }
          }
          else {
            if (nestedProp !== 'enabled') {
              Configuration.ImageConfig[property][nestedProp] = parseInt(document.getElementById(property + nestedProp + 'elem').value);
            }
          }
        }
      }
    }
  }
}


/**
 * initialize filter form
 */
function initalizeFilterForm() {
  document.querySelector('#filterMode input[value ="' + Configuration.AppConfig.filterType + '"]').checked = true;
  document.querySelector('#chkEnableFileSizeFilter').checked = Configuration.ImageConfig.filesize.enabled;
  document.querySelector('#chkEnableFileDimensionFilter').checked = Configuration.ImageConfig.dimensions.enabled;
  const dimensionsminwidthelem = document.getElementById('dimensionsminwidthelem');
  const dimensionsmaxwidthelem = document.getElementById('dimensionsmaxwidthelem');
  const dimensionsminheightelem = document.getElementById('dimensionsminheightelem');
  const dimensionsmaxheightelem = document.getElementById('dimensionsmaxheightelem');
  const filesizeminelem = document.getElementById('filesizeminelem');
  const filesizemaxelem = document.getElementById('filesizemaxelem');
  if (Configuration.ImageConfig.filesize.enabled === true) {
    filesizeminelem.removeAttribute('disabled');
    filesizemaxelem.removeAttribute('disabled');
  }
  else {
    filesizeminelem.setAttribute('disabled', true);
    filesizemaxelem.setAttribute('disabled', true);
  }

  if (Configuration.ImageConfig.dimensions.enabled === true) {
    dimensionsminwidthelem.removeAttribute('disabled');
    dimensionsmaxwidthelem.removeAttribute('disabled');
    dimensionsminheightelem.removeAttribute('disabled');
    dimensionsmaxheightelem.removeAttribute('disabled');
  }
  else {
    dimensionsminwidthelem.setAttribute('disabled', true);
    dimensionsmaxwidthelem.setAttribute('disabled', true);
    dimensionsminheightelem.setAttribute('disabled', true);
    dimensionsmaxheightelem.setAttribute('disabled', true);
  }
  for (let property in Configuration.ImageConfig) {
    if (Configuration.ImageConfig.hasOwnProperty(property)) {
      for (let nestedProp in Configuration.ImageConfig[property]) {
        if (Configuration.ImageConfig[property].hasOwnProperty(nestedProp)) {
          if (property === 'filetype') {
            document.getElementById(property + nestedProp + 'elem').checked = Configuration.ImageConfig[property][nestedProp];
          }
          else if (property === 'filesize') {
            if (nestedProp !== 'enabled') {
              document.getElementById(property + nestedProp + 'elem').value = Configuration.ImageConfig[property][nestedProp] / 1024;
            }
          }
          else {
            if (nestedProp !== 'enabled') {
              document.getElementById(property + nestedProp + 'elem').value = Configuration.ImageConfig[property][nestedProp];
            }
          }
        }
      }
    }
  }
}

/**
 * select all images
 */
function selectAll() {
  [...document.querySelectorAll('.gallery-item')].forEach(p => p.classList.add('gallery-item-selected'));
  selectionChangedUI();
}

/**
 * unselect all images
 */
function unselectAll() {
  [...document.querySelectorAll('.gallery-item-selected')].forEach(p => p.classList.remove('gallery-item-selected'));
  selectionChangedUI();
}

/**
 * selection change ui
 */
function selectionChangedUI() {
  const galleryItemSelectedCount = document.querySelectorAll('.gallery-item-selected').length;
  document.getElementById('lblTotalSelected').textContent = galleryItemSelectedCount;
  const downloadButton = document.getElementById('btnDownload');
  const deselectButton = document.getElementById('btnDeselect');
  if (galleryItemSelectedCount > 0) {
    downloadButton.classList.remove('button-disabled');
    deselectButton.classList.remove('button-disabled');
  }
  else {
    downloadButton.classList.add('button-disabled');
    deselectButton.classList.add('button-disabled');
  }
}

/**
 * compute base64
 * @param {string} base64String
 * @return {number} size
 */
function computeBase64Size(base64String) {
  const stringLength = base64String.length - 'data:image/png;base64,'.length;

  const sizeInBytes = 4 * Math.ceil((stringLength / 3)) * 0.5624896334383812;
  return sizeInBytes;
}

/**
 * compute base64
 * @param {string} request
 */
function startInnerProcess(request) {
  if (deepLinksPointer <= deepLinks.length) {
    Promise.all([getHtmlPages(deepLinks[deepLinksPointer])]).then(results => {
      deepLinksPointer++;
      results = results.filter(p => p !== undefined);
      const htmlParseOut = [];
      results.forEach(q => htmlParseOut.push(parseLinksFromHtml(q.url, q.html, q.htmlText)));
      Promise.all(htmlParseOut.map(p =>
        gettingData(p.url, p.styleSheetsText, p.imgTagsSrcText, p.linksText, p.imgInlineStyleSrc))).then(() => {
        removeEmptyURLs();
        removeDuplicateURLs();
        startInnerProcess(request);
      }).catch(promisErr => {
        console.log(promisErr);
      });
    }).catch(promisErr => {
      console.log(promisErr);
    });
  }
  else {
    isFinishProcess = true;
  }
}

/**
 * getting data from injected pages
 * @param {string} url
 * @param {array} styleSheets
 * @param {string} imgTagsSrcText
 * @param {string} linksText
 * @return {promise}
 */
function gettingData(url, styleSheets, imgTagsSrcText, linksText, inlineStyle = '') {
  return new Promise(resolve => {
    imgTagsSrcText.forEach(p => {
      data.push(p);
      getTotalLinks();
    });

    const backgroundStyles = ImageDownloader.findAllBackgroundStyles(url, globalHtmlText);
    if (backgroundStyles !== undefined) {
      backgroundStyles.forEach(p => {
        data.push(p);
        getTotalLinks();
      });
    }

    if (inlineStyle.length > 0) {
      inlineStyle.forEach( p => {
        data.push(p);
        getTotalLinks();
      });
    }
    const styleSheetUrls = styleSheets;
    Promise.all(styleSheetUrls.map(p => getStyleSheetsContent(p))).then(results => {
      results = results.filter(p => p !== undefined);
      for (let i = 0; i < results.length; i++) {
        ImageDownloader.getStyleSheetBackgrounds(styleSheetUrls[i], results[i], result => {
          result.forEach(q => {
            data.push(q);
            getTotalLinks();
          });
        });
      }
      resolve();
    }).catch(promisErr => {
      console.log(promisErr);
    });

    if (parseInt(deepLevelDec) >= 1) {
      linksText.forEach(p => {
        data.push(p);
        getTotalLinks();
      });
      if (parseInt(baseDeepLevel) !== 2) {
        deepLevelDec = parseInt(deepLevelDec) - 1;
      }
    }
  });
}

/**
 * parse links from html text
 * @param {string} url
 * @param {string} htmlContent
 * @return {object}
 */
function parseLinksFromHtml(url, htmlContent, htmlText = '') {
  let styleSheets = null;
  let styleSheetsText = '';
  let imgTagsSrc = null;
  let imgTagsSrcText = '';
  let links = null;
  let linksText = '';
  let imgInlineStyleSrc = null;

  const hostname = ImageDownloader.extractHostname(url);
  const protocol = ImageDownloader.extractProtocol(url);
  const port = ImageDownloader.extractPort(url);
  let browser = 'chrome';
  if (navigator.userAgent.indexOf('Firefox') > -1) {
    browser = 'firefox';
  }

  const styles = htmlContent.querySelectorAll('link[rel="stylesheet"]');
  styleSheets = [...styles].map(p => p.href);
  styleSheets = styleSheets.filter(p => p !== null);
  for (let i = 0; i < styleSheets.length; i++) {
    if (styleSheets[i].indexOf('chrome-extension://') > -1 || styleSheets[i].indexOf('moz-extension://') > -1) {
      if (browser === 'chrome') {
        styleSheets[i] = styleSheets[i].replace('chrome-extension://', '');
      }
      else {
        styleSheets[i] = styleSheets[i].replace('moz-extension://', '');
      }
      styleSheets[i] = protocol + '//' + hostname + (port !== '' ? (':' + port) : '') + styleSheets[i].substring(styleSheets[i].indexOf('/'));
      if (styleSheets[i].indexOf('data/popup/') > -1) {
        styleSheets[i] = styleSheets[i].replace('data/popup/', '');
      }
    }
  }
  styleSheetsText = styleSheets;

  imgTagsSrc = [...htmlContent.images].map(p => p.src);
  imgTagsSrc = imgTagsSrc.filter(p => p !== null);
  for (let i = 0; i < imgTagsSrc.length; i++) {
    if (imgTagsSrc[i].indexOf('chrome-extension://') > -1 || imgTagsSrc[i].indexOf('moz-extension://') > -1) {
      if (browser === 'chrome') {
        imgTagsSrc[i] = imgTagsSrc[i].replace('chrome-extension://', '');
      }
      else {
        imgTagsSrc[i] = imgTagsSrc[i].replace('moz-extension://', '');
      }
      imgTagsSrc[i] = protocol + '//' + hostname + (port !== '' ? (':' + port) : '') + imgTagsSrc[i].substring(imgTagsSrc[i].indexOf('/'));
      if (imgTagsSrc[i].indexOf('data/popup/') > -1) {
        imgTagsSrc[i] = imgTagsSrc[i].replace('data/popup/', '');
      }
    }
  }
  imgTagsSrcText = imgTagsSrc;

  links = [...htmlContent.links].map(p => p.href);
  links = links.filter(p => p !== null);
  for (let i = 0; i < links.length; i++) {
    if (links[i].indexOf('chrome-extension://') > -1 || links[i].indexOf('moz-extension://') > -1) {
      if (browser === 'chrome') {
        links[i] = links[i].replace('chrome-extension://', '');
      }
      else {
        links[i] = links[i].replace('moz-extension://', '');
      }
      links[i] = protocol + '//' + hostname + links[i].substring(links[i].indexOf('/'));
    }
  }
  linksText = links;
  imgInlineStyleSrc = ImageDownloader.findAllBackgroundStyles(url, htmlText);

  return {url, styleSheetsText, imgTagsSrcText, linksText, imgInlineStyleSrc};
}

/**
 * parse links from html text
 * @param {string} url
 * @return {promise}
 */
function getStyleSheetsContent(url) {
  return new Promise(resolve => {
    const request = new XMLHttpRequest();
    request.open('GET', url);
    request.onload = function() {
      if (request.status === 200) {
        resolve(request.responseText);
      }
      else {
        resolve(undefined);
      }
    };
    request.onerror = function() {
      resolve(undefined);
    };
    request.send();
  });
}

/**
 * fetch image array
 * @param {string} imgUrl
 * @return {promise}
 */
function fetchImages(imgUrl) {
  return new Promise(resolve => {
    document.getElementById('lblImageUrlProgress').textContent = imgUrl;
    const imageProgressbar = document.getElementById('progressbarForImage');
    imageProgressbar.style.width = '0%';
    ImageDownloader.getHeaderInfo(imgUrl, responseHeaderInfo => {
      if (responseHeaderInfo.state === 'success') {
        ImageDownloader.getOriginalImage(imgUrl, originalImage => {
          imageProgressbar.style.width = '100%';
          if (responseHeaderInfo.imageSize === null) {
            responseHeaderInfo.imageSize = computeBase64Size(originalImage.src);
          }
          responseHeaderInfo.width = originalImage.width;
          responseHeaderInfo.height = originalImage.height;
          const obj = {image: originalImage, responseHeaderInfo: responseHeaderInfo};
          if (cache.findIndex(p => p.image.src === obj.image.src) > -1) {
            resolve(undefined);
          }
          else {
            if (obj.image.width > 0 && obj.image.height > 0) {
              cache.push(obj);
              resolve(obj);
            }
            else {
              resolve(undefined);
            }
          }
        });
      }
      else {
        resolve();
      }
    });
  });
}

/**
 * starting main process function
 */
function loadingProcess() {
  if (data.length >= 1) {
    const cancelFlag = cancelProcessEvent();
    if (cancelFlag === true) {
      return;
    }

    let fetchArray = [];
    if (fetchPointer + 4 <= data.length - 1) {
      fetchArray = [fetchImages(data[fetchPointer + 1]),
        fetchImages(data[fetchPointer + 2]),
        fetchImages(data[fetchPointer + 3]),
        fetchImages(data[fetchPointer + 4])];
    }
    else if (fetchPointer + 3 <= data.length - 1) {
      fetchArray = [fetchImages(data[fetchPointer + 1]),
        fetchImages(data[fetchPointer + 2]),
        fetchImages(data[fetchPointer + 3])];
    }
    else if (fetchPointer + 2 <= data.length - 1) {
      fetchArray = [fetchImages(data[fetchPointer + 1]),
        fetchImages(data[fetchPointer + 2])];
    }
    else if (fetchPointer + 1 <= data.length - 1) {
      fetchArray = [fetchImages(data[fetchPointer + 1])];
    }
    else {
      if ((parseInt(baseDeepLevel) > 1 && isFinishProcess === true) || deepLevelDec === '0' || deepLevelDec === 0) {
        if (tabCounter > tabList.length - 1) {
          finishProcess();
          clearInterval(intervalId);
        }
        else {
          chrome.runtime.sendMessage({action: 'injectContentScript', tabId: tabList[tabCounter]}, responseAllTab => {
            startProcess(responseAllTab);
          });
          chrome.tabs.get(tabList[tabCounter], tab => {
            showProcessingTabUrl(tab.url);
          });
          tabCounter++;
        }
      }
      return;
    }

    Promise.all(fetchArray).then(result => {
      result = result.filter(p => p !== undefined & p !== '' && p.responseHeaderInfo.hasOwnProperty('imageType'));
      for (let i = 0; i < result.length; i++) {
        UI.makeImageElement(result[i].image, result[i].responseHeaderInfo);
      }
      fetchPointer += fetchArray.length;
      getTotalProcessLinks();
      const progressPercent = document.getElementById('lblProgressPercent');
      const progressbar = document.getElementById('progressbar');
      let percentValue = Math.round((fetchPointer / (data.length - 1)) * 100);
      if (percentValue > 100) {
        percentValue = 100;
      }
      const mediaWidth = window.matchMedia('(max-width: 800px)');
      if (mediaWidth.matches) {
        progressPercent.textContent = percentValue + ' % ';
      }
      else {
        progressPercent.textContent = chrome.i18n.getMessage('formula') + percentValue + ' % - ' + chrome.i18n.getMessage('processing');
      }
      progressbar.style.width = percentValue + '%';
      loadingProcess();
    }).catch(promisErr => {
      console.log(promisErr);
    });
  }
}

/**
 * this function remove all potential empty urls.
 */
function removeEmptyURLs() {
  data = data.filter(p => p !== '');
  getTotalLinks();
}

/**
 * this function remove duplicate urls
 */
function removeDuplicateURLs() {
  data = data.filter(function(item, pos) {
    return data.indexOf(item) === pos;
  });
  getTotalLinks();
}

/**
 * this function get html pages from urls.
 * @param {string} url
 * @return {promise}
 */
function getHtmlPages(url) {
  return new Promise((resolve, reject) => {
    const cancelFlag = cancelProcessEvent();
    if (cancelFlag === true) {
      reject();
      return;
    }
    const request = new XMLHttpRequest();
    request.open('GET', url);
    request.timeout = 10000;
    request.onload = function() {
      if (request.status === 200) {
        if (request.getResponseHeader('content-type') !== null && request.getResponseHeader('content-type').indexOf('html') > -1) {
          try {
            const htmlText = request.responseText;
            const parser = new DOMParser();
            const html = parser.parseFromString(htmlText, 'text/html');
            resolve({url: url, html: html, htmlText: htmlText});
          }
          catch (e) {
            resolve();
          }
        }
        else {
          resolve();
        }
      }
      else {
        resolve();
      }
    };
    request.onerror = function() {
      resolve();
    };
    request.ontimeout = function() {
      resolve();
    };
    request.abort = function() {
      resolve();
    };
    request.send();
  });
}

/**
 * starting main process function
 * @param {array} primaryLinks
 * @return {promise}
 */
function getDeepLinks(primaryLinks) {
  return new Promise((resolve, reject) => {
    const cancelFlag = cancelProcessEvent();
    if (cancelFlag === true) {
      reject();
      return;
    }
    const newLinks = [];
    Promise.all(primaryLinks.map(p => getHtmlPages(p))).then(results => {
      results = results.filter(p => p !== undefined);
      results.forEach(p => {
        const returnObj = parseLinksFromHtml(p.url, p.html, p.htmlText);
        const newLinksTemp = returnObj.linksText;
        newLinksTemp.forEach(q => {
          newLinks.push(q);
        });
      });
      newLinks.forEach(p => {
        deepLinks.push(p);
      });
      deepLevelDec = parseInt(deepLevelDec) - 1;
      resolve(newLinks);
    }).catch(promisErr => {
      console.log(promisErr);
    });
  });
}

/**
 * cancel main process
 * @return {bool}
 */
function cancelProcessEvent() {
  const cancelFlag = document.getElementById('hdfCancelFlag');
  if (cancelFlag.value === 'true') {
    return true;
  }
}

/**
 * initialize form controls after cancellation
 */
function initalizeCancelProcess() {
  const progressText = document.getElementById('lblProgressPercent');
  progressText.textContent = chrome.i18n.getMessage('progress_cancel');

  const progressbar = document.getElementById('progressbar');
  progressbar.style.cssText = 'background-color: #EC644B; width: 100%;';
}

/**
 * get total links
 */
function getTotalLinks() {
  const totalLinks = document.getElementById('lblTotalLinks');
  totalLinks.textContent = data.length;
}

/**
 * get total processed links.
 */
function getTotalProcessLinks() {
  const links = document.getElementById('lblTotalProcessLinks');
  if (fetchPointer + 1 > data.length) {
    fetchPointer = data.length - 1;
  }
  links.textContent = fetchPointer + 1;
}

document.getElementById('deepLevelInput').oninput = e => {
  Configuration.AppConfig.deepLevel = e.target.value > 2 ? 2 : e.target.value < 0 ? 0 : e.target.value;
  chrome.storage.local.set({'AppConfig': Configuration.AppConfig});
  //chrome.runtime.sendMessage({action: 'deepNotification'});
};

/**
 * starting main process function
 */
function finishProcess() {
  document.getElementById('lblProgressPercent').textContent = '100% - ' + chrome.i18n.getMessage('finished');
  document.getElementById('btnStop').classList.add('button-disabled');
  document.getElementById('progressbar').style.backgroundColor = '#03A678';

  const progressbarForImage = document.getElementById('progressbarForImage');
  progressbarForImage.style.backgroundColor = '#03A678';
  progressbarForImage.style.width = '100%';
  progressbarForImage.parentNode.querySelector('span').textContent = chrome.i18n.getMessage('all_images_download');

  selectAll();
}

/**
 * show currently processing tab.
 * @param {string} url
 */
function showProcessingTabUrl(url) {
  document.getElementById('tabTitle').textContent = ' ' + url;
}

document.getElementById('chkEnableFileSizeFilter').addEventListener('change', e => {
  const filesizeminelem = document.getElementById('filesizeminelem');
  const filesizemaxelem = document.getElementById('filesizemaxelem');
  Configuration.ImageConfig.filesize.enabled = e.target.checked;
  chrome.storage.local.set({'ImageConfig': Configuration.ImageConfig});
  if (e.target.checked === true) {
    filesizeminelem.removeAttribute('disabled');
    filesizemaxelem.removeAttribute('disabled');
  }
  else {
    filesizeminelem.setAttribute('disabled', true);
    filesizemaxelem.setAttribute('disabled', true);
  }
});

document.getElementById('chkEnableFileDimensionFilter').addEventListener('change', e => {
  const dimensionsminwidthelem = document.getElementById('dimensionsminwidthelem');
  const dimensionsmaxwidthelem = document.getElementById('dimensionsmaxwidthelem');
  const dimensionsminheightelem = document.getElementById('dimensionsminheightelem');
  const dimensionsmaxheightelem = document.getElementById('dimensionsmaxheightelem');
  Configuration.ImageConfig.dimensions.enabled = e.target.checked;
  chrome.storage.local.set({'ImageConfig': Configuration.ImageConfig});
  if (e.target.checked === true) {
    dimensionsminwidthelem.removeAttribute('disabled');
    dimensionsmaxwidthelem.removeAttribute('disabled');
    dimensionsminheightelem.removeAttribute('disabled');
    dimensionsmaxheightelem.removeAttribute('disabled');
  }
  else {
    dimensionsminwidthelem.setAttribute('disabled', true);
    dimensionsmaxwidthelem.setAttribute('disabled', true);
    dimensionsminheightelem.setAttribute('disabled', true);
    dimensionsmaxheightelem.setAttribute('disabled', true);
  }
});

[...document.getElementsByClassName('sepAccordion-control')].forEach(p => {
  p.addEventListener('click', e => {
    e.target.previousElementSibling.classList.toggle('sepAccordion-open');
    e.target.nextElementSibling.classList.toggle('sepAccordion-panel-show');
  });
});

document.getElementById('filterMode').addEventListener('change', evt => {
  Configuration.AppConfig.filterType = evt.target.value;
  chrome.storage.local.set({'AppConfig': Configuration.AppConfig});
  if (Configuration.AppConfig.filterType === 'selection') {
    cache.forEach(p => {
      p.image.parentNode.style.display = 'flex';
    });
  }
  else {
    cache.forEach(p => {
      p.image.parentNode.classList.remove('gallery-item-selected');
    });
    selectionChangedUI();
  }
});

/**
 * starting main process function
 * @param {object} responseObj
 */
function startProcess(responseObj) {
  let htmlText = responseObj.htmlContent;
  globalHtmlText = htmlText;
  chrome.storage.local.get({'AppConfig': Configuration.AppConfig}, result => {
    const appConfig = result.AppConfig;
    deepLevelDec = appConfig.deepLevel.toString();
    baseDeepLevel = deepLevelDec;
    if (parseInt(deepLevelDec) > 1) {

      const links = responseObj.linksText;
      links.forEach(p => {
        deepLinks.push(p);
      });
      clearInterval(intervalId);
      intervalId = setInterval(function() {
        loadingProcess();
      }, 1000);
      getDeepLinks(links).then(newLinks => {
        if (deepLevelDec === 1) {
          startInnerProcess(responseObj);
        }
        else {
          getDeepLinks(newLinks).then(newLinks2 => {
            console.log(deepLevelDec);

            if (deepLevelDec === 1) {
              startInnerProcess(responseObj);
            }
            else {
              getDeepLinks(newLinks2).then(() => {
                if (deepLevelDec === 1) {
                  startInnerProcess(responseObj);
                }
              });
            }
          });
        }
      }).catch(promisErr => {
        console.log(promisErr);
      });
    }
    gettingData(responseObj.url,
       responseObj.styleSheets, responseObj.imgTagsSrcText, responseObj.linksText).then(() => {
      removeEmptyURLs();
      removeDuplicateURLs();
      loadingProcess();
    }).catch(promisErr => {
      console.log(promisErr);
    });
  });
}
