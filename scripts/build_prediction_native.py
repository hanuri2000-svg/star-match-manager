#!/usr/bin/env python3
"""Build the native Match Dorang module from the standalone app source."""

from __future__ import annotations

import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SOURCE_ROOT = ROOT.parent / "star-prediction-github"
SOURCE_HTML = SOURCE_ROOT / "index.html"
SOURCE_THEME = SOURCE_ROOT / "pastel-theme.css"
OUTPUT = ROOT / "prediction-native.js"


def scope_css(css: str) -> str:
    css = css.replace(":root", ":host")
    css = re.sub(r"\bhtml\b", ":host", css)
    css = re.sub(r"\bbody\b", ".prediction-body", css)
    return css


def prefix_handlers(source: str) -> str:
    source = re.sub(
        r'on(click|input|change)="data\.current=\$\{i\};save\(\)"',
        r'on\1="window.PredictionNative.selectHistory(${i})"',
        source,
    )
    source = re.sub(
        r'onchange="scheduleDraft\[\$\{i\}\]\.(tier1|tier2|race1|race2)=this\.value"',
        r'onchange="window.PredictionNative.setScheduleDraft(${i},\'\1\',this.value)"',
        source,
    )
    source = re.sub(
        r'on(click|input|change)="([A-Za-z_$][\w$]*)\(',
        r'on\1="window.PredictionNative.\2(',
        source,
    )
    return source


def main() -> None:
    html = SOURCE_HTML.read_text(encoding="utf-8")
    theme = SOURCE_THEME.read_text(encoding="utf-8")

    head = html.split("</head>", 1)[0]
    base_styles = "\n".join(re.findall(r"<style>(.*?)</style>", head, re.S))

    body_start = html.index('<div class="wrap">')
    script_marker = "<script>\nconst KEY="
    script_start = html.index(script_marker, body_start)
    template = html[body_start:script_start]
    template = re.sub(r'<div class="brand">.*?</div></div>\s*', "", template, count=1, flags=re.S)
    template = re.sub(r'<button class="btn view-toggle".*?</button>\s*', "", template, count=1, flags=re.S)
    template = re.sub(r'<button class="btn" onclick="checkForUpdate\(true\)">.*?</button>\s*', "", template, count=1, flags=re.S)
    template = re.sub(r'<footer class="credit">.*?</footer>\s*', "", template, count=1, flags=re.S)
    template = prefix_handlers(template)
    template = '<div class="prediction-body embedded">\n' + template.strip() + "\n</div>"

    script_body = html[script_start + len("<script>\n") :]
    script_body = script_body.rsplit("</script>", 1)[0].strip()
    script_body = script_body.rsplit("</body>", 1)[0].strip()
    script_body = script_body.replace(
        "window.addEventListener('DOMContentLoaded',()=>__masterPlayerObserver.observe(document.body,{childList:true,subtree:true}));",
        "__masterPlayerObserver.observe(document.body,{childList:true,subtree:true});",
    )
    script_body = re.sub(
        r"\nconst VIEW_MODE_KEY=.*?(?=\ndocument\.addEventListener\('keydown')",
        "\n",
        script_body,
        count=1,
        flags=re.S,
    )
    script_body = prefix_handlers(script_body)

    handlers = sorted(
        set(
            re.findall(
                r"window\.PredictionNative\.([A-Za-z_$][\w$]*)\(",
                template + script_body,
            )
        )
    )
    helpers = """
function selectHistory(index){
  data.current=Number(index);
  save();
}
function setScheduleDraft(index,key,value){
  if(scheduleDraft[index])scheduleDraft[index][key]=value;
}
"""
    api_names = sorted(set(handlers) | {"selectHistory", "setScheduleDraft"})
    api = "window.PredictionNative={" + ",".join(api_names) + "};"
    script_body = re.sub(
        r"\nrender\(\);\s*$",
        "\n" + helpers + "\n" + api + "\nrender();",
        script_body,
    )

    styles = scope_css(base_styles + "\n" + theme)
    styles += r"""
:host{display:block;width:100%;min-height:680px;color:#51485f}
.prediction-body{min-height:680px;background:linear-gradient(180deg,#fffafd 0%,#f9fbff 100%)!important;overflow-x:hidden}
.prediction-body>.wrap{width:100%;max-width:none!important;padding:10px 14px 24px!important}
.prediction-body header{position:static!important;margin-bottom:10px!important;padding:4px 0 10px!important}
.prediction-body header .brand,.prediction-body #viewToggle,.prediction-body .credit{display:none!important}
.prediction-body header .btn{min-height:38px}
.prediction-body .layout{align-items:start}
@media(max-width:700px){
  :host,.prediction-body{min-height:560px}
  .prediction-body>.wrap{padding:7px 7px 18px!important}
  .prediction-body header{gap:6px!important}
  .prediction-body header .btn{min-height:38px;padding:8px 9px!important;font-size:11px!important}
}
"""

    output = """/* 맞혀도랑 v6.2.0 통합 모듈 · iframe 없이 Shadow DOM에서 실행 */
(()=>{
const TEMPLATE=%s;
const STYLES=%s;
window.mountPredictionNative=function(host){
  if(!host)return;
  const mounted=window.__predictionNativeHost;
  if(mounted&&mounted!==host){host.replaceWith(mounted);return mounted;}
  if(host.dataset.predictionMounted==='1')return host;
  host.dataset.predictionMounted='1';
  window.__predictionNativeHost=host;
  const root=host.shadowRoot||host.attachShadow({mode:'open'});
  root.innerHTML='<style>'+STYLES+'</style>'+TEMPLATE;
  const realDocument=window.document;
  const body=root.querySelector('.prediction-body');
  const document={
    querySelector:root.querySelector.bind(root),
    querySelectorAll:root.querySelectorAll.bind(root),
    getElementById:root.getElementById.bind(root),
    createElement:realDocument.createElement.bind(realDocument),
    addEventListener:root.addEventListener.bind(root),
    body,
    visibilityState:'visible'
  };
%s
  return host;
};
const existing=document.querySelector('[data-prediction-native-host]');
if(existing)window.mountPredictionNative(existing);
})();
""" % (
        json.dumps(template, ensure_ascii=False),
        json.dumps(styles, ensure_ascii=False),
        script_body,
    )
    OUTPUT.write_text(output, encoding="utf-8")
    print(f"wrote {OUTPUT} ({OUTPUT.stat().st_size:,} bytes)")


if __name__ == "__main__":
    main()
