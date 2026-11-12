/* Style the isolated quiz module with the same light journal components. */
(function () {
  const css = `:host{color-scheme:light;--bg:#faf8fd;--panel:#fffefd;--text:#443854;--muted:#71647e;--line:#e8deef}
.prediction-body{background:#faf8fd!important;color:#443854!important;font-family:Pretendard,'Noto Sans KR',system-ui,sans-serif!important}
.prediction-body .wrap{padding:22px!important}
.prediction-body :is(header,.card,.panel,.asl-panel,.asl-row,.asl-result>div){background:#fffefd!important;border:1px solid #ebe3f1!important;border-radius:18px!important;box-shadow:0 8px 30px #71558d08!important;color:#443854!important}
.prediction-body :is(input,select,textarea){background:#fffefd!important;border:1px solid #e5daee!important;border-radius:10px!important;color:#443854!important}
.prediction-body :is(.btn,button){border-radius:11px!important;font-weight:500!important;box-shadow:none!important}
.prediction-body .btn:not(.primary):not(.danger){background:#f7f1fb!important;color:#665375!important;border:1px solid #e8deef!important}
.prediction-body :is(.btn.primary,.primary){background:#8060a8!important;color:white!important;border-color:#8060a8!important}
.prediction-body :is(h1,h2,h3,.asl-title,.asl-row b){color:#665077!important}
.prediction-body .danger{color:#a33e62!important;background:#fff1f5!important}
@media(max-width:700px){.prediction-body .wrap{padding:12px!important}}`;
  window.applyStarlogThemeToShadow = function(root) {
    if (!root || root.querySelector('[data-starlog-shadow]')) return;
    const style = document.createElement('style');
    style.dataset.starlogShadow='1';style.textContent=css;root.appendChild(style);
  };
  document.querySelectorAll('[data-prediction-native-host]').forEach(host=>window.applyStarlogThemeToShadow(host.shadowRoot));
})();
