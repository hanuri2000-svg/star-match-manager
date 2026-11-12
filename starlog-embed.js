/* Same-origin My Starlog: shares records with the standalone sponsor notebook. */
(function () {
  window.mountSpwnNoteNative = function (host) {
    if (!host || host.querySelector('iframe')) return;
    const frame = document.createElement('iframe');
    frame.src = './starlog/index.html?v=2.0.15';
    frame.title = '마이 스타로그 · 스폰노트';
    frame.style.cssText = 'display:block;width:100%;height:100%;min-height:0;border:0;background:#faf7ff';
    host.replaceChildren(frame);
  };
  window.mountSpwnNoteNative(document.querySelector('[data-spwn-native-host]'));
})();
