import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import fs from 'node:fs';
const {buildIndex,search,normalize,initials}=createRequire(import.meta.url)('../integrated-search.js');
const source={main:{title:'뉴캣슬 CK',schedules:[{id:'s1',title:'뉴캣슬 CK',date:'2026-10-03',time:'20:00',note:'도랑이 출전'},{id:'s2',title:'스폰 방송',date:'2026-10-04',note:'투혼 연습'}],playersA:[{id:'p1',name:'최도랑',tier:'4티어'}],playersB:[{id:'p2',name:'늑대채린',tier:'4티어'}],matches:[{id:'m1',a:'p1',b:'p2',set:1,map:'실피드'}],aces:[{id:'ace1',a:'p1',b:'p2',map:'투혼'}]},players:[{name:'최도랑',tier:'4티어',race:'P',aliases:['도랑이']},{name:'최도랑',tier:'4티어',race:'P'},{name:'비활성 선수',active:false},{name:'늑대채린',tier:'4티어',race:'Z'}],records:[{id:1,date:'2026-10-01',opponent:'늑대채린',result:'승',map:'투혼',myBuild:'더블넥',note:'셔틀 컨트롤 연습',feedback:'프로브 정찰 타이밍'},{id:2,date:'2026-10-02',opponent:'키링',result:'패',map:'실피드'}],prediction:{tournament:'ASL',participants:['시청자'],matches:[{p1:'이재호',p2:'도재욱',tier1:'갓',tier2:'갓'}]}};
test('일정·선수·스폰 기록·예측·대진·메뉴를 실제 데이터에서 모으고 선수를 중복 제거한다',()=>{
 const index=buildIndex(source);
 assert.equal(index.filter(row=>row.kind==='player').length,2);
 assert.equal(index.filter(row=>row.kind==='schedule').length,2);
 assert.equal(index.filter(row=>row.kind==='record').length,2);
 assert.equal(index.filter(row=>row.kind==='prediction').length,1);
 assert.equal(index.filter(row=>row.kind==='match').length,2);
 assert.deepEqual(search(index,'뉴캣슬 CK','schedule').items[0].target,{kind:'schedule',id:'s1',date:'2026-10-03'});
 assert.deepEqual(search(index,'ASL','prediction').items[0].target,{kind:'prediction',index:0,p1:'이재호',p2:'도재욱'});
 assert.equal(search(index,'ACE','match').items[0].target.id,'ace1');
});
test('이름 일부·초성·별칭과 여러 검색 조건을 지원한다',()=>{
 const index=buildIndex(source);
 assert.equal(search(index,'도랑 4티어','player').total,1);
 assert.equal(search(index,'ㅊㄷㄹ','player').items[0].title,'최도랑');
 assert.equal(search(index,'ㄷㄹ','player').items[0].title,'최도랑');
 assert.equal(search(index,'도랑이','player').items[0].title,'최도랑');
 assert.equal(search(index,'최 도랑 프로토스','player').total,1);
 assert.equal(search(index,'도랑 저그','player').total,0);
 assert.equal(normalize(' ASL 2026.10.03 '),'asl20261003');assert.equal(initials('최도랑'),'ㅊㄷㄹ');
});
test('날짜 구분자를 바꿔도 찾고 메모·피드백·빌드도 검색한다',()=>{
 const index=buildIndex(source);
 assert.equal(search(index,'2026.10.03','schedule').items[0].target.id,'s1');
 assert.equal(search(index,'2026/10/03','schedule').total,1);
 for(const query of ['셔틀','프로브 정찰','더블넥'])assert.equal(search(index,query,'record').items[0].target.id,1);
 assert.equal(search(index,'키링 실피드','record').items[0].target.id,2);
});
test('정확한 이름을 먼저 보여 주고 날짜가 있는 기록은 최신순으로 정렬한다',()=>{
 const index=buildIndex({...source,players:[...source.players,{name:'최도랑팬',tier:'8티어'}]});
 assert.equal(search(index,'최도랑').items[0].title,'최도랑');
 assert.deepEqual(search(index,'스폰','record').items.map(row=>row.target.id),[2,1]);
});
test('전체 건수·범위별 건수는 결과 제한과 무관하고 빈 검색은 메뉴만 표시한다',()=>{
 const index=buildIndex(source);const found=search(index,'4티어','all',1);
 assert.equal(found.items.length,1);assert.equal(found.total,4);assert.equal(found.counts.player,2);assert.equal(found.counts.match,2);
 assert.ok(search(index,'').items.every(row=>row.kind==='menu'));
 assert.equal(search(index,'백업').items[0].target.section,'backup');
 assert.equal(search(index,'알림센터').items[0].target.section,'notification');
 assert.equal(search(index,'동기화').items[0].target.section,'sync');
});
test('손상되거나 비어 있는 자료도 메뉴 검색을 막지 않고 원본 자료를 수정하지 않는다',()=>{
 const before=JSON.stringify(source);buildIndex(source);assert.equal(JSON.stringify(source),before);
 assert.equal(buildIndex({main:null,players:null,records:[null],prediction:null}).length,11);
 assert.equal(search(buildIndex(source),'<script>').total,0);
 assert.equal(buildIndex({records:[{id:'01',opponent:'상대',note:'메모'}]}).find(row=>row.kind==='record').target.id,1);
});
test('통합 검색은 가벼운 비동기 모듈이고 릴리스 버전과 일치한다',()=>{
 const root=new URL('../',import.meta.url);const main=fs.readFileSync(new URL('index.html',root),'utf8');const version=JSON.parse(fs.readFileSync(new URL('version.json',root),'utf8')).version;
 assert.ok(main.includes(`<script async src="./integrated-search.js?v=${version}"></script>`));
 assert.ok(main.includes('window.openIntegratedSearchTarget='));
});
