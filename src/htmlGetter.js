'use strict';
if (typeof styleSheets === 'undefined' && typeof imgTagsSrc === 'undefined' && typeof links === 'undefined') {
  var styleSheets = null;
  var imgTagsSrc = null;
  var links = null;
  var result = null;
}

styleSheets = [...document.styleSheets].map(p => p.href);
styleSheets = styleSheets.filter(p => p !== null);

imgTagsSrc = [...document.images].map(p => p.src);
imgTagsSrc = imgTagsSrc.filter(p => p !== null);

links = [...document.links].map(p => p.href);
links = links.filter(p => p !== null);


result = {htmlContent: document.documentElement.innerHTML,
  url: window.location.href, styleSheets: styleSheets,
  imgTagsSrcText: imgTagsSrc,
  linksText: links};

result;
