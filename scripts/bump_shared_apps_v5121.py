from pathlib import Path
import os,json,base64,urllib.request,urllib.parse
p=Path('index.html')
html=p.read_text(encoding='utf-8')
html=html.replace("const APP_VERSION='5.12.0'","const APP_VERSION='5.12.1'",1)
html=html.replace('../spwn-note/?embed=1&amp;v=1.5.0','../spwn-note/?embed=1&amp;v=1.6.0')
html=html.replace('../spwn-note/?embed=1&v=1.5.0','../spwn-note/?embed=1&v=1.6.0')
p.write_text(html,encoding='utf-8')
repo=os.environ['GITHUB_REPOSITORY'];token=os.environ['GH_TOKEN']
def api(path,method='GET',payload=None):
    url='https://api.github.com/repos/'+repo+'/contents/'+urllib.parse.quote(path,safe='/')
    req=urllib.request.Request(url,method=method,headers={'Authorization':'Bearer '+token,'Accept':'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','User-Agent':'shared-app-bump'})
    if payload is not None:req.data=json.dumps(payload).encode();req.add_header('Content-Type','application/json')
    with urllib.request.urlopen(req) as r:return json.load(r)
sha=api('index.html').get('sha')
body={'message':'Refresh shared app embeds v5.12.1','content':base64.b64encode(html.encode()).decode(),'branch':'main','sha':sha}
api('index.html','PUT',body)
