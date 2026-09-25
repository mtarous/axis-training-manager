/* AXIS v19 カレンダー即時取得
   Apps Script(op=calendar)からGoogleカレンダーの予定を直接読み、
   リポジトリ同梱のスナップショット(calendar-current.enc)より新しければ差し替える。
   どの予定を取り込むかの判定は従来どおりクライアント側(normalizedCalendarSchedule)で行う。 */
(function(){
"use strict";

const SETTINGS_KEY="axis_sync_settings_v1";
const CACHE_KEY="axis_calendar_live_v1";
const CAL_KEY="axis_calendar_id_v1";   /* 読み取り対象のカレンダーID（空ならスクリプト実行者の既定） */
const MAX_AGE_MS=10*60*1000;   /* この時間内に取得済みなら再取得しない */
let inFlight=null;

function settings(){
  try{
    const x=JSON.parse(localStorage.getItem(SETTINGS_KEY)||"{}")||{};
    const endpoint=String(x.endpoint||"").trim();
    const token=String(x.token||"").trim();
    return endpoint&&token?{endpoint,token}:null;
  }catch(e){return null}
}
function calendarId(){ return String(localStorage.getItem(CAL_KEY)||"").trim() }
function setCalendarId(v){
  const x=String(v||"").trim();
  if(x) localStorage.setItem(CAL_KEY,x); else localStorage.removeItem(CAL_KEY);
}
window.axisCalendarId=calendarId;
function cache(){
  try{const x=JSON.parse(localStorage.getItem(CACHE_KEY)||"null");return x&&Array.isArray(x.events)?x:null}catch(e){return null}
}
function writeCache(x){
  try{localStorage.setItem(CACHE_KEY,JSON.stringify(x))}catch(e){}
}

function jsonp(endpoint,params,timeoutMs=15000){
  return new Promise((resolve,reject)=>{
    const cb="axisCal"+Math.random().toString(36).slice(2);
    const script=document.createElement("script");
    let timer=0;
    const done=(fn,v)=>{clearTimeout(timer);delete window[cb];script.remove();fn(v)};
    window[cb]=v=>done(resolve,v);
    script.onerror=()=>done(reject,new Error("カレンダーサーバーに接続できませんでした"));
    timer=setTimeout(()=>done(reject,new Error("カレンダー取得がタイムアウトしました")),timeoutMs);
    script.src=endpoint+"?"+new URLSearchParams({...params,callback:cb}).toString();
    document.head.appendChild(script);
  });
}

function applyEvents(events,syncedAt){
  if(typeof META!=="object"||!META) return;
  META.calendarEvents=events;
  META.calendarSyncedAt=syncedAt;
  META.calendarLoadError=false;
  META.calendarLive=true;
  if(typeof renderAll==="function") renderAll();
}

/* 起動時：前回取得分がキャッシュにあれば即反映（通信を待たせない） */
function applyCached(){
  const c=cache();
  if(c&&c.events.length) applyEvents(c.events,c.syncedAt);
  return !!c;
}

async function refresh(opts){
  const o=opts||{};
  const s=settings();
  if(!s) throw new Error("「その他 → 端末間の自動同期」で同期先URLとトークンを設定すると、カレンダーを直接読み込めます。");
  if(inFlight) return inFlight;
  inFlight=(async()=>{
    const params={op:"calendar",token:s.token,back:String(o.back??14),days:String(o.days??90)};
    const cid=calendarId(); if(cid) params.calendarId=cid;
    const r=await jsonp(s.endpoint,params);
    if(!r||r.ok===false) throw new Error(String(r&&r.error||"カレンダーを取得できませんでした"));
    const events=Array.isArray(r.events)?r.events:[];
    const syncedAt=String(r.syncedAt||new Date().toISOString());
    writeCache({events,syncedAt,at:Date.now()});
    applyEvents(events,syncedAt);
    return {count:events.length,syncedAt};
  })();
  try{ return await inFlight; } finally { inFlight=null; }
}

async function refreshIfStale(){
  if(!settings()) return;
  const c=cache();
  if(c&&Date.now()-Number(c.at||0)<MAX_AGE_MS) return;
  try{ await refresh(); }catch(e){ /* 取得できなければ同梱スナップショットのまま */ }
}

window.axisRefreshCalendar=async function(){
  const btn=document.querySelector("#axisCalRefresh");
  if(btn){btn.disabled=true;btn.dataset.label=btn.textContent;btn.textContent="取得中…"}
  try{
    const r=await refresh();
    if(btn) btn.textContent=`${r.count}件を取得`;
    setTimeout(()=>{if(btn){btn.disabled=false;btn.textContent=btn.dataset.label||"カレンダーを更新"}},1800);
  }catch(e){
    alert(String(e.message||e));
    if(btn){btn.disabled=false;btn.textContent=btn.dataset.label||"カレンダーを更新"}
  }
};

/* 同期先から、使えるカレンダーの一覧を取り出して選ばせる */
window.axisChooseCalendar=async function(){
  const s=settings();
  if(!s){ alert("先に「その他 → 端末間の自動同期」で同期先URLとトークンを設定してください。"); return }
  let r;
  try{ r=await jsonp(s.endpoint,{op:"calendars",token:s.token}); }
  catch(e){ alert(String(e.message||e)); return }
  if(!r||r.ok===false){ alert(String(r&&r.error||"カレンダー一覧を取得できませんでした")); return }
  const list=Array.isArray(r.calendars)?r.calendars:[];
  if(!list.length){ alert("このアカウントから見えるカレンダーがありませんでした。"); return }
  const cur=calendarId()||r.defaultId||"";
  const lines=list.map((c,i)=>`${i+1}. ${c.name}（${c.id}）${c.id===cur?" ←いま選択中":""}`).join("\n");
  const ans=prompt("読み込むカレンダーの番号を入力してください。\n\n"+lines,String(Math.max(1,list.findIndex(c=>c.id===cur)+1)));
  if(ans===null) return;
  const n=Number(ans);
  if(!Number.isFinite(n)||n<1||n>list.length){ alert("番号が正しくありません。"); return }
  setCalendarId(list[n-1].id);
  localStorage.removeItem(CACHE_KEY);
  alert(`「${list[n-1].name}」を読み込みます。`);
  window.axisRefreshCalendar();
};

/* スケジュール画面に更新ボタンを出す */
function injectButton(){
  if(document.querySelector("#axisCalRefresh")) return;
  const status=document.querySelector("#schedule .ax16-calendar-status")||document.querySelector(".ax16-calendar-status");
  if(!status) return;
  const b=document.createElement("button");
  b.id="axisCalRefresh";
  b.type="button";
  b.className="ax19-calrefresh";
  b.textContent="カレンダーを更新";
  b.onclick=()=>window.axisRefreshCalendar();
  status.appendChild(b);
  const c=document.createElement("button");
  c.id="axisCalChoose";
  c.type="button";
  c.className="ax19-calrefresh";
  c.textContent="カレンダーを選ぶ";
  c.onclick=()=>window.axisChooseCalendar();
  status.appendChild(c);
}
window.axisInjectCalendarButton=injectButton;

const prevAfterUnlock=window.axisAfterUnlock;
window.axisAfterUnlock=function(){
  if(typeof prevAfterUnlock==="function"){try{prevAfterUnlock()}catch(e){}}
  applyCached();
  refreshIfStale();
  setTimeout(injectButton,400);
};
document.addEventListener("click",()=>setTimeout(injectButton,80));
})();

/* スケジュールを開いたとき、過去ではなく今日以降の位置から見せる */
(function(){
"use strict";
function scrollToToday(){
  const view=document.querySelector("#schedule");
  if(!view||!view.classList.contains("on")) return;
  const t=typeof today==="function"?today():"";
  if(!t) return;
  const y=Number(t.slice(0,4)), m=Number(t.slice(5,7)), d=Number(t.slice(8,10));
  const heads=[...view.querySelectorAll("*")].filter(e=>e.children.length===0&&/^\d{4}年\d{1,2}月\d{1,2}日/.test(e.textContent.trim()));
  const target=heads.find(e=>{
    const x=e.textContent.trim().match(/^(\d{4})年(\d{1,2})月(\d{1,2})日/);
    if(!x) return false;
    const key=Number(x[1])*10000+Number(x[2])*100+Number(x[3]);
    return key>=y*10000+m*100+d;
  });
  if(target) target.scrollIntoView({block:"start",behavior:"auto"});
}
window.axisScrollScheduleToToday=scrollToToday;
document.addEventListener("click",e=>{
  const b=e.target.closest("button,a");
  if(b&&b.textContent.trim()==="スケジュール") setTimeout(scrollToToday,260);
},true);
})();
