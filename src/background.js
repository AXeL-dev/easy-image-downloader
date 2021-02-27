'use strict';

/*
window.setTimeout(function () {
  chrome.storage.local.get("version", e => {
    if (!e.version) {
      var version = chrome.runtime.getManifest().version;
      var homepage = chrome.runtime.getManifest().homepage_url;
      var url = homepage + "?v=" + version + "&type=install";
      chrome.tabs.create({"url": url, "active": true});
      chrome.storage.local.set({"version": version}, function () {});
    }
  });
}, 3000);
*/

/**
 * Notification for deep search.
 */
function deepSearchNotification() {
  chrome.notifications.create({
    type: 'basic',
    title: '',
    iconUrl: 'data/icons/256.png',
    message: chrome.i18n.getMessage('no_active_dowloads')
  });
}

function createContextMenu(popupMode) {
  chrome.contextMenus.create({
    'id': 'imageDownloaderContextMenu',
    'title': chrome.i18n.getMessage('deep_search_contenxt'),
    'contexts': ['link'],
    'documentUrlPatterns': ['*://*/*']
  });

  chrome.contextMenus.create({
    'id': 'popupModeContextMenu',
    'title': chrome.i18n.getMessage('open_in_popup_mode'),
    'contexts': ['browser_action'],
    'type': 'checkbox',
    'checked': popupMode,
    'documentUrlPatterns': ['*://*/*']
  });
}

/**
 * create browser action context menu
 */
function createBrowserActionContextMenu() {
  chrome.contextMenus.create({
    'id': 'getAllImages',
    'title': chrome.i18n.getMessage('browserAction_context_menu'),
    'contexts': ['browser_action'],
    'documentUrlPatterns': ['*://*/*']
  });
}

/**
 * event on click on context menus
 */
chrome.contextMenus.onClicked.addListener(e => {
  switch (e.menuItemId) {
    case 'getAllImages':
      chrome.tabs.create({'url':
        chrome.extension.getURL('data/popup/popup.html')}, imgTab => {
        chrome.storage.local.set({'imageTab': imgTab.id});
      });
      break;
    case 'imageDownloaderContextMenu':
      chrome.tabs.create({'url':
      chrome.extension.getURL('data/popup/popup.html?url=' + e.linkUrl)},
      () => {
      });
      break;
    case 'popupModeContextMenu':
      chrome.storage.local.set({'popupMode': e.checked});
      break;
  }
});

chrome.storage.onChanged.addListener(changes => {
  const keys = Object.keys(changes);
  const popupIndex = keys.indexOf('popupMode');
  if (popupIndex > -1) {
    if (changes.popupMode.newValue === true) {
      chrome.browserAction.setPopup({popup: 'data/popup/popup.html'}, () => {
      });
    }
    else {
      chrome.browserAction.setPopup({popup: ''}, () => {
      });
    }
  }
});

chrome.runtime.onStartup.addListener(() => {
  chrome.storage.local.get({'popupMode': false}, result => {
    if (result.popupMode === true) {
      chrome.browserAction.setPopup({popup: 'data/popup/popup.html'}, () => {
      });
    }
  });
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get({'popupMode': false}, result => {
    if (result.popupMode === true) {
      chrome.browserAction.setPopup({popup: 'data/popup/popup.html'}, () => {
      });
    }
    createContextMenu(result.popupMode);
    createBrowserActionContextMenu();
  });
});

const injectContentScript = function(tabId, callback) {
  chrome.tabs.executeScript(tabId, {file: 'htmlGetter.js', matchAboutBlank: true}, result => {
    if (!chrome.runtime.lastError) {
      callback(result);
    }
  });
};

chrome.browserAction.onClicked.addListener(tab => {
  chrome.storage.local.get({'popupMode': false}, result => {
    if (result.popupMode === false) {
      chrome.tabs.create({'url':
       chrome.extension.getURL('data/popup/popup.html?tabId=' +
        tab.id.toString())}, () => {
      });
    }
  });
});

chrome.runtime.onMessage.addListener((request, sender, responseCallback) => {
  switch (request.action) {
    case 'deepNotification':
      deepSearchNotification();
      break;
    case 'injectContentScript':
      injectContentScript(parseInt(request.tabId), results => {
        let htmlContentQ = '';
        results.map(p => p.htmlContent).forEach(p => {
          htmlContentQ += p;
        });

        let imgTagsSrcTextQ = [];
        results.map(p => p.imgTagsSrcText).forEach(p => {
          p.forEach(q => {
            imgTagsSrcTextQ.push(q);
          });
        });

        let linksTextQ = [];
        results.map(p => p.linksText).forEach(p => {
          p.forEach(q => {
            linksTextQ.push(q);
          });
        });

        let styleSheetsQ = [];
        results.map(p => p.styleSheets).forEach(p => {
          p.forEach(q => {
            styleSheetsQ.push(q);
          });
        });
        const finalResult = {
          htmlContent: htmlContentQ,
          imgTagsSrcText: imgTagsSrcTextQ,
          linksText: linksTextQ,
          styleSheets: styleSheetsQ,
          url: results[0].url
        };
        responseCallback(finalResult);
      });
      break;
  }
  return true;
});

/*
if (chrome.runtime.setUninstallURL) {
  var version = chrome.runtime.getManifest().version;
  var homepage = chrome.runtime.getManifest().homepage_url;
  var url = homepage + "?v=" + version + "&type=uninstall";
  chrome.runtime.setUninstallURL(url, function () {});
}
*/
