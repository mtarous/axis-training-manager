/* ===== AXIS v16 : design layer (home / muscle figures / charts / nav) =====
   既存関数を window 経由で上書きする。データ構造には一切触れない。 */
(function(){
"use strict";
const S=s=>document.querySelector(s);

/* ---------- アイコン ---------- */
const ICONS={
 dumbbell:'<path d="M3 9v6M6 7v10M18 7v10M21 9v6M6 12h12" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/>',
 cube:'<path d="M12 2 21 7v10l-9 5-9-5V7z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M3 7l9 5 9-5M12 12v10" fill="none" stroke="currentColor" stroke-width="1.5"/>',
 ring:'<circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="2.4" stroke-dasharray="38 60" stroke-linecap="round"/>',
 cal:'<rect x="3" y="5" width="18" height="16" rx="3" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M3 10h18M8 3v4M16 3v4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
 chart:'<path d="M4 20V10M10 20V4M16 20v-7M22 20H2" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/>',
 body:'<circle cx="12" cy="5" r="2.6" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 8v7M12 15l-3 6M12 15l3 6M6 10h12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" fill="none"/>',
 bulb:'<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>',
 plus:'<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 8v8M8 12h8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
 note:'<rect x="5" y="3" width="14" height="18" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M9 8h6M9 12h6M9 16h3" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>',
 clock:'<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 7v5l3 2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" fill="none"/>',
 chev:'<path d="M9 5l7 7-7 7" stroke="currentColor" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
 home:'<path d="M3 11l9-8 9 8v9a2 2 0 0 1-2 2h-4v-7H9v7H5a2 2 0 0 1-2-2z" fill="currentColor"/>',
 users:'<circle cx="9" cy="8" r="3.4" fill="currentColor"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0z" fill="currentColor"/><circle cx="17.5" cy="9.5" r="2.6" fill="currentColor" opacity=".75"/><path d="M14.6 20a7.3 7.3 0 0 1 1.2-3.9 5 5 0 0 1 6.2 3.9z" fill="currentColor" opacity=".75"/>',
 bars:'<rect x="3" y="12" width="4" height="9" rx="1.4" fill="currentColor"/><rect x="10" y="6" width="4" height="15" rx="1.4" fill="currentColor"/><rect x="17" y="9" width="4" height="12" rx="1.4" fill="currentColor"/>',
 dots:'<circle cx="5" cy="12" r="2" fill="currentColor"/><circle cx="12" cy="12" r="2" fill="currentColor"/><circle cx="19" cy="12" r="2" fill="currentColor"/>',
 guide:'<rect x="3" y="4" width="18" height="14" rx="3" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M10 8.5l5 2.5-5 2.5z" fill="currentColor"/>'
};
window.v16Icon=(n,cls)=>`<svg class="${cls||""}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[n]||""}</svg>`;

/* ---------- 人体図（解剖学ベース） ---------- */
const MIR=x=>(200-x).toFixed(1);
function limbs(){return `
 <ellipse class="v16-body" cx="100" cy="32" rx="17" ry="21"/>
 <path class="v16-body" d="M88 50 L88 64 Q100 72 112 64 L112 50 Z"/>
 <path class="v16-body" d="M56 80 Q100 62 144 80 L138 122 Q132 152 127 170 L131 199 Q100 211 69 199 L73 170 Q68 152 62 122 Z"/>
 <path class="v16-body" d="M57 82 Q45 88 42 108 L37 149 Q35 159 39 166 L51 166 Q51 153 53 145 L61 111 Z"/>
 <path class="v16-body" d="M143 82 Q155 88 158 108 L163 149 Q165 159 161 166 L149 166 Q149 153 147 145 L139 111 Z"/>
 <path class="v16-body" d="M39 167 Q35 192 31 216 L29 239 L42 241 L46 216 L51 168 Z"/>
 <path class="v16-body" d="M161 167 Q165 192 169 216 L171 239 L158 241 L154 216 L149 168 Z"/>
 <path class="v16-body" d="M69 201 Q63 248 71 300 L94 300 Q97 248 97 201 Z"/>
 <path class="v16-body" d="M131 201 Q137 248 129 300 L106 300 Q103 248 103 201 Z"/>
 <path class="v16-body" d="M73 304 Q69 352 75 394 L91 394 Q95 352 92 304 Z"/>
 <path class="v16-body" d="M127 304 Q131 352 125 394 L109 394 Q105 352 108 304 Z"/>
 <path class="v16-body" d="M74 396 L92 396 L94 408 Q83 412 72 408 Z"/>
 <path class="v16-body" d="M126 396 L108 396 L106 408 Q117 412 128 408 Z"/>`}

function figFront(cl){return `<svg viewBox="0 0 200 420" role="img" aria-label="正面の筋肉">${limbs()}
 <path class="v16-m ${cl("肩")}" d="M57 80 Q44 87 42 108 Q55 116 67 105 Q68 88 57 80 Z"/>
 <path class="v16-m ${cl("肩")}" d="M143 80 Q156 87 158 108 Q145 116 133 105 Q132 88 143 80 Z"/>
 <path class="v16-m ${cl("胸")}" d="M74 92 Q88 84 98 93 L98 120 Q84 128 73 117 Z"/>
 <path class="v16-m ${cl("胸")}" d="M126 92 Q112 84 102 93 L102 120 Q116 128 127 117 Z"/>
 <rect class="v16-m ${cl("腹筋")}" x="88" y="126" width="24" height="52" rx="9"/>
 <path class="v16-sep" d="M88 143h24M88 160h24M100 126v52"/>
 <ellipse class="v16-m ${cl("二頭")}" cx="47" cy="126" rx="10" ry="23" transform="rotate(-8 47 126)"/>
 <ellipse class="v16-m ${cl("二頭")}" cx="153" cy="126" rx="10" ry="23" transform="rotate(8 153 126)"/>
 <path class="v16-m ${cl("大腿四頭筋")}" d="M73 208 Q68 250 75 290 L93 290 Q96 250 95 208 Z"/>
 <path class="v16-m ${cl("大腿四頭筋")}" d="M127 208 Q132 250 125 290 L107 290 Q104 250 105 208 Z"/>
 <ellipse class="v16-m ${cl("ふくらはぎ")}" cx="83" cy="342" rx="8.5" ry="29"/>
 <ellipse class="v16-m ${cl("ふくらはぎ")}" cx="117" cy="342" rx="8.5" ry="29"/></svg>`}

function figBack(cl){return `<svg viewBox="0 0 200 420" role="img" aria-label="背面の筋肉">${limbs()}
 <path class="v16-m ${cl("肩")}" d="M57 80 Q44 87 42 108 Q55 116 67 105 Q68 88 57 80 Z"/>
 <path class="v16-m ${cl("肩")}" d="M143 80 Q156 87 158 108 Q145 116 133 105 Q132 88 143 80 Z"/>
 <path class="v16-m ${cl("広背筋")}" d="M64 88 Q100 76 136 88 L127 152 Q100 174 73 152 Z"/>
 <path class="v16-sep" d="M100 84v90"/>
 <rect class="v16-m ${cl("脊柱起立筋")}" x="93" y="120" width="14" height="60" rx="7"/>
 <ellipse class="v16-m ${cl("三頭")}" cx="47" cy="126" rx="10" ry="23" transform="rotate(-8 47 126)"/>
 <ellipse class="v16-m ${cl("三頭")}" cx="153" cy="126" rx="10" ry="23" transform="rotate(8 153 126)"/>
 <ellipse class="v16-m ${cl("臀筋")}" cx="84" cy="212" rx="17" ry="16"/>
 <ellipse class="v16-m ${cl("臀筋")}" cx="116" cy="212" rx="17" ry="16"/>
 <path class="v16-m ${cl("ハム")}" d="M73 238 Q69 268 76 294 L93 294 Q96 266 95 238 Z"/>
 <path class="v16-m ${cl("ハム")}" d="M127 238 Q131 268 124 294 L107 294 Q104 266 105 238 Z"/>
 <ellipse class="v16-m ${cl("ふくらはぎ")}" cx="83" cy="340" rx="9.5" ry="31"/>
 <ellipse class="v16-m ${cl("ふくらはぎ")}" cx="117" cy="340" rx="9.5" ry="31"/></svg>`}

window.muscleMap=function(rows,opts){
 const o=opts||{},on=new Set((rows||[]).flatMap(r=>musclesForExercise(r.exercise||r)));
 const named=[...on].filter(x=>x!=="全身");
 const wholeBody=on.has("全身")&&!named.length;
 const cl=x=>(named.includes(x)||wholeBody)?"on":"";
 const chips=o.chips===false?"":`<div class="ax16-chips">${named.slice(0,12).map(x=>`<span class="ax16-chip">${esc(x)}</span>`).join("")}</div>`;
 return `<div class="ax16-figs"><div class="ax16-fig"><div class="cap">FRONT</div>${figFront(cl)}</div><div class="ax16-fig"><div class="cap">BACK</div>${figBack(cl)}</div></div>${chips}`;
};

/* ---------- 期間別データ ---------- */
function ymd(d){return axisDateLocal(d)}
function volOn(pred){let v=0;sessions().forEach(s=>{if(pred(s.date))v+=sessionVolume(s)});return Math.round(v)}
window.v16Series=function(range){
 const now=new Date();
 if(range==="month"){
   const y=now.getFullYear(),m=now.getMonth(),last=new Date(y,m+1,0).getDate(),out=[];
   for(let a=1;a<=last;a+=7){const b=Math.min(a+6,last);
     out.push({label:`${m+1}/${a}`,v:volOn(d=>{const dd=new Date(d+"T00:00:00");return dd.getFullYear()===y&&dd.getMonth()===m&&dd.getDate()>=a&&dd.getDate()<=b})})}
   return out;
 }
 if(range==="q"||range==="year"){
   const n=range==="q"?3:12,out=[];
   for(let i=n-1;i>=0;i--){const d=new Date(now.getFullYear(),now.getMonth()-i,1),y=d.getFullYear(),m=d.getMonth();
     out.push({label:`${m+1}月`,v:volOn(s=>{const dd=new Date(s+"T00:00:00");return dd.getFullYear()===y&&dd.getMonth()===m})})}
   return out;
 }
 return axisWeekSessions().map((x,i)=>({label:["月","火","水","木","金","土","日"][i],v:x.v}));
};

/* ---------- 棒グラフ（目盛り・ピーク表示） ---------- */
function niceMax(v){if(v<=0)return 1000;const p=Math.pow(10,Math.floor(Math.log10(v)));const s=[1,2,2.5,5,10];for(const k of s){if(v<=p*k)return p*k}return p*10}
window.axisBarChart=function(items){
 if(!items||!items.length)return '<div class="ax16-mut">データなし</div>';
 const norm=items.map(x=>({label:x.label!==undefined?x.label:(typeof fmt==="function"?fmt(x.d).slice(0,5):""),v:Number(x.v)||0}));
 const mx=niceMax(Math.max(...norm.map(x=>x.v))),peak=norm.reduce((a,b)=>b.v>a.v?b:a,norm[0]);
 const lines=[0,.25,.5,.75,1].map(r=>`<i style="top:${(1-r)*100}%"></i><b style="top:${(1-r)*100}%">${(mx*r).toLocaleString()}</b>`).join("");
 return `<div class="ax16-chartwrap"><div class="ax16-grid">${lines}</div><div class="ax16-bars">${norm.map(x=>{
   const h=Math.max(2,Math.round(x.v/mx*100)),isP=x.v>0&&x===peak;
   return `<div class="ax16-col${isP?" peak":""}">${isP?`<div class="ax16-tip">${x.v.toLocaleString()} kg</div>`:""}<div class="ax16-bar" style="height:${h}%"></div><div class="ax16-xl">${esc(x.label)}</div></div>`}).join("")}</div></div>`;
};

/* ---------- 統計 ---------- */
window.v16Stats=function(){
 const t=today(),now=new Date(),ym=t.slice(0,7);
 const prev=new Date(now.getFullYear(),now.getMonth()-1,1),pym=`${prev.getFullYear()}-${String(prev.getMonth()+1).padStart(2,"0")}`;
 const ss=sessions().filter(x=>x.date<=t);
 const curN=ss.filter(x=>x.date.startsWith(ym)).length;
 const prvN=ss.filter(x=>x.date.startsWith(pym)&&Number(x.date.slice(8))<=now.getDate()).length;
 const week=axisWeekSessions(),wVol=week.reduce((a,x)=>a+x.v,0);
 const st=new Date(now);st.setHours(0,0,0,0);st.setDate(now.getDate()-((now.getDay()+6)%7)-7);
 let pVol=0;for(let i=0;i<7;i++){const d=new Date(st);d.setDate(st.getDate()+i);const k=ymd(d);ss.forEach(s=>{if(s.date===k)pVol+=sessionVolume(s)})}
 const cut=new Date();cut.setDate(cut.getDate()-30);const c=ymd(cut),cs=clientList();
 const elig=cs.filter(x=>sessions(x.name).some(s=>s.date<c));
 const act=elig.filter(x=>sessions(x.name).some(s=>s.date>=c&&s.date<=t)).length;
 const pct=(a,b)=>b>0?Math.round((a-b)/b*100):null;
 return {month:curN,monthDelta:pct(curN,prvN),week:Math.round(wVol),weekDelta:pct(wVol,Math.round(pVol)),
   rate:elig.length?Math.round(act/elig.length*100):100,active:act,eligible:elig.length,
   monthSpark:lastN(12,ym),weekSpark:week.map(x=>x.v)};
};
function lastN(n,ym){const out=[],now=new Date();for(let i=n-1;i>=0;i--){const d=new Date(now.getFullYear(),now.getMonth()-i,1),k=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;out.push(sessions().filter(s=>s.date.startsWith(k)).length)}return out}
function spark(a){const mx=Math.max(...a,1);return `<div class="ax16-spark">${a.slice(-7).map(v=>`<i style="height:${Math.max(10,Math.round(v/mx*100))}%"></i>`).join("")}</div>`}
function delta(d){if(d===null||d===undefined)return "";const c=d>0?"up":d<0?"dn":"flat",s=d>0?"↑":d<0?"↓":"→";return `<div class="ax16-delta ${c}">${s} ${d>0?"+":""}${d}%</div>`}
function ring(p){const r=22,c=2*Math.PI*r,o=c*(1-Math.min(100,Math.max(0,p))/100);
 return `<div class="ax16-ring"><svg viewBox="0 0 52 52"><defs><linearGradient id="v16ring" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#18cdff"/><stop offset="1" stop-color="#0056cc"/></linearGradient></defs><circle class="bg" cx="26" cy="26" r="${r}"/><circle class="fg" cx="26" cy="26" r="${r}" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${o.toFixed(1)}"/></svg></div>`}

/* ---------- ホーム ---------- */
window.v16Range="week";
window.v16SetRange=function(r){v16Range=r;const p=S("#v16chart");if(p)p.innerHTML=chartInner()};
function chartInner(){
 const data=v16Series(v16Range),total=data.reduce((a,x)=>a+x.v,0),st=v16Stats();
 const tabs=[["week","今週"],["month","今月"],["q","3か月"],["year","1年"]];
 return `<div class="ax16-head"><div class="ax16-h"><span class="ic">${v16Icon("chart")}</span>データ分析</div>
  <button class="ax16-more" onclick="show('analytics');renderAnalytics()">${v16Icon("chev")}</button></div>
 <div class="ax16-seg">${tabs.map(t=>`<button class="${v16Range===t[0]?"on":""}" onclick="v16SetRange('${t[0]}')">${t[1]}</button>`).join("")}</div>
 <div class="ax16-eyebrow">TRAINING VOLUME</div>
 <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin:2px 0 14px">
   <div class="ax16-big">${total.toLocaleString()}<u>kg</u></div>${v16Range==="week"?delta(st.weekDelta):""}</div>
 ${axisBarChart(data)}`;
}
window.renderHome=function(){
 const t=today(),sch=mergedSchedule(),todays=sch.filter(x=>x.date===t),up=sch.filter(x=>x.date>t).slice(0,2);
 const st=v16Stats(),last=sessions().find(x=>x.date<=t);
 const focus=todays.find(x=>x.type==="パーソナル"&&clientList().some(c=>c.name===x.client))||up.find(x=>x.type==="パーソナル"&&clientList().some(c=>c.name===x.client));
 const a=focus?analyzeClient(focus.client):null;
 S("#home").innerHTML=`
 <div class="ax16-hero"><div class="ax16-herotop">
   <div class="ax16-logo">A<i>X</i>IS<small>TRAINING</small></div>
   </div>
   <div class="ax16-date">${v16Icon("cal")}${jp(t)}</div>
   <div class="ax16-lead">今日の予定 ${todays.length}件</div></div>
 ${calendarSyncNotice()}

 <div class="ax16-stats">
  <div class="ax16-stat"><div class="ic">${v16Icon("dumbbell")}</div><label>今月のセッション</label>
    <div class="ax16-statrow"><div><strong>${st.month}<u>回</u></strong>${delta(st.monthDelta)}</div>${spark(st.monthSpark)}</div></div>
  <div class="ax16-stat"><div class="ic">${v16Icon("cube")}</div><label>今週の総ボリューム</label>
    <div class="ax16-statrow"><div><strong>${st.week.toLocaleString()}<u>kg</u></strong>${delta(st.weekDelta)}</div>${spark(st.weekSpark)}</div></div>
  <div class="ax16-stat"><div class="ic">${v16Icon("ring")}</div><label>継続率</label>
    <div class="ax16-statrow"><div><strong>${st.rate}<u>%</u></strong><div class="ax16-delta flat">${st.active} / ${st.eligible} 人</div></div>${ring(st.rate)}</div></div>
 </div>

 <div class="ax16-panel"><div class="ax16-head"><div class="ax16-h"><span class="ic">${v16Icon("cal")}</span>今日の予定</div>
   <button class="ax16-more" onclick="show('schedule')">すべて見る ${v16Icon("chev")}</button></div>
   ${todays.length?todays.map(v16Sch).join(""):(up.length?`<div class="ax16-mut" style="margin-bottom:8px">今日の予定はありません。次の予定：</div>`+up.map(v16Sch).join(""):'<div class="ax16-mut">今日の予定はありません</div>')}</div>

 <div class="ax16-panel" id="v16chart">${chartInner()}</div>

 <div class="ax16-panel"><div class="ax16-head"><div class="ax16-h"><span class="ic">${v16Icon("body")}</span>鍛えた部位</div>
   ${last?`<button class="ax16-more" onclick="openClient('${String(last.client).replace(/'/g,"\\'")}')">詳細 ${v16Icon("chev")}</button>`:""}</div>
   ${muscleMap(last?.rows||[])}
   <div class="ax16-mut" style="text-align:center;margin-top:8px">● 直近のトレーニングで使用した部位</div></div>

 <div class="ax16-panel"><div class="ax16-head"><div class="ax16-h"><span class="ic">${v16Icon("bulb")}</span>次回提案</div></div>
   <b style="font-size:15px">${a?.next?.[0]?esc(a.next[0].exercise):"次のセッションを準備"}</b>
   <div class="ax16-mut" style="margin-top:6px">${a?.next?.[0]?esc(a.next[0].text):"利用者を開くと、過去記録から次回メニューを提案します。"}</div></div>

 <div class="ax16-panel"><div class="ax16-head"><div class="ax16-h"><span class="ic">${v16Icon("plus")}</span>クイック入力</div>
   <span class="ax16-mut" style="font-size:11px">その場でサッと記録</span></div>
   <div class="ax16-2" style="margin-bottom:9px">
     <button class="ax16-btn soft" onclick="show('input');renderInput(draft||{})">${v16Icon("dumbbell")}重量・回数</button>
     <button class="ax16-btn soft" onclick="show('input');renderInput(draft||{});setTimeout(()=>document.querySelector('#fnote')?.focus(),120)">${v16Icon("note")}メモのみ</button></div>
   <button class="ax16-btn pri full" onclick="show('input');renderInput(draft||{})">トレーニングを記録する ${v16Icon("chev")}</button></div>`;
};
window.v16Sch=function(s){
 const l=s.type==="パーソナル"?latest(s.client,s.date):null,isC=s.type==="パーソナル"&&clientList().some(x=>x.name===s.client);
 const goal=META.goals?.[s.client];
 return `<div class="ax16-sch" ${isC?`onclick="openClient('${String(s.client).replace(/'/g,"\\'")}')"`:""}>
  <div class="ax16-schtime"><b>${esc(s.time||"--:--")}</b><span>${s.type==="パーソナル"?"PT":esc(s.type||"予定")}</span></div>
  <div class="ax16-schmain"><b>${esc(s.label||s.client)}</b><div class="sub">${goal?esc(goal):(s.calendar?"Google Calendar":"AXIS TRAINING")}</div>
   <div class="ax16-tags">${l?`<span class="ax16-tag">${l.rows.length}種目</span>`:""}${s.type==="パーソナル"?`<span class="ax16-tag">${v16Icon("clock")}40分</span>`:""}${s.calendar?'<span class="ax16-tag">Calendar</span>':""}</div></div>
  <div class="ax16-chev">${v16Icon("chev")}</div></div>`;
};

/* ---------- 下部ナビ ---------- */
const NAV=[["home","ホーム","home"],["clients","利用者","users"],["schedule","スケジュール","cal"],["analytics","分析","bars"],["more","その他","dots"]];
window.v16Nav=function(){
 const b=S("#bottom");if(!b)return;
 b.innerHTML=NAV.map(([v,label,ic])=>`<button class="nav" data-v="${v}"><b>${v16Icon(ic)}</b>${label}</button>`).join("");
 b.querySelectorAll(".nav").forEach(x=>x.onclick=()=>{show(x.dataset.v);
   if(x.dataset.v==="analytics"&&window.renderAnalytics)renderAnalytics();
   if(x.dataset.v==="more"&&window.renderMore)renderMore();
   if(x.dataset.v==="clients"&&window.renderClients)renderClients()});
 const on=document.querySelector(".view.on")?.id||"home";
 b.querySelectorAll(".nav").forEach(x=>x.classList.toggle("on",x.dataset.v===on));
};
const _renderAll=window.renderAll;
window.renderAll=function(){_renderAll&&_renderAll();v16Nav()};
document.addEventListener("DOMContentLoaded",v16Nav);
setTimeout(v16Nav,300);setTimeout(v16Nav,1500);
})();
