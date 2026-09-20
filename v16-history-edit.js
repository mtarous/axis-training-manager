/* AXIS v16 history editing
   Overlay-only edits. data.enc / BASE / added are never mutated here. */
(function(){
"use strict";

const EDIT_KEY="axis_training_edits_v1";
const baseAll=window.all;
let editOrigin={view:"history",client:""};

function S(s){return document.querySelector(s)}
function jsq(s){return String(s||"").replace(/\\/g,"\\\\").replace(/'/g,"\\'")}
function keyToken(key){
  return btoa(unescape(encodeURIComponent(String(key||"")))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
}
function tokenKey(token){
  let s=String(token||"").replace(/-/g,"+").replace(/_/g,"/");
  while(s.length%4)s+="=";
  return decodeURIComponent(escape(atob(s)));
}
function loadEdits(){
  try{const x=JSON.parse(localStorage.getItem(EDIT_KEY)||"{}");return x&&typeof x==="object"&&!Array.isArray(x)?x:{}}catch(e){return{}}
}
function saveEdits(x){
  if(Object.keys(x).length)localStorage.setItem(EDIT_KEY,JSON.stringify(x));
  else localStorage.removeItem(EDIT_KEY);
}
function rawAnnotated(){
  const rows=baseAll(),forward=new Map(),reverseOrdinal=new Array(rows.length);
  // App sessions are added with unshift(). Count duplicate app rows from oldest
  // to newest so a newly saved same-day exercise cannot move an existing key.
  const reverse=new Map();
  for(let i=rows.length-1;i>=0;i--){
    const row=rows[i];
    if(row.source!=="アプリ入力")continue;
    const group=[row.date||"",row.client||"",row.exercise||"",row.source||""].join("\u241f");
    const n=reverse.get(group)||0;reverse.set(group,n+1);reverseOrdinal[i]=n;
  }
  return rows.map((row,i)=>{
    const group=[row.date||"",row.client||"",row.exercise||"",row.source||""].join("\u241f");
    let n;
    if(row.source==="アプリ入力")n=reverseOrdinal[i]??0;
    else{n=forward.get(group)||0;forward.set(group,n+1)}
    const key=JSON.stringify([row.date||"",row.client||"",row.exercise||"",row.source||"",n]);
    return {key,row};
  });
}
function rawByKey(key){return rawAnnotated().find(x=>x.key===key)?.row||null}
function cleanNumber(v,fallback){
  const s=String(v??"").trim();
  if(s==="")return "";
  const n=Number(s);
  return Number.isFinite(n)?n:(fallback??s);
}
function same(a,b){return String(a??"")===String(b??"")}
function changedFields(raw,patch){
  return ["date","client","exercise","weight","reps","sets","achieved","memo"].filter(k=>!same(raw?.[k],patch?.[k]));
}

window.axisHistoryEdits=loadEdits;
window.axisRawHistoryRows=()=>rawAnnotated().map(x=>({...x.row,_axisKey:x.key}));

window.all=function(){
  const edits=loadEdits();
  return rawAnnotated().filter(x=>!edits[x.key]?.deleted).map(x=>{
    const e=edits[x.key],patch=e?.patch||{};
    return {...x.row,...patch,_axisKey:x.key,_axisEdited:!!e};
  });
};
window.appRows=function(){
  return window.all().filter(r=>r.source==="アプリ入力").map(r=>({
    date:r.date,client:r.client,exercise:r.exercise,weight:r.weight,reps:r.reps,sets:r.sets,
    achieved:r.achieved,memo:r.memo,source:r.source
  }));
};

function editBadge(row){
  return row._axisEdited?'<span class="axhe-badge">編集済み</span>':"";
}
function axisHistCard(s){
  return '<div class="axhe-card">'+
    '<div class="axhe-cardhead"><div><b>'+esc(s.date)+'｜'+esc(s.client)+'</b><div class="axhe-source">'+esc(s.source||"既存記録")+'</div></div></div>'+
    '<div class="axhe-rows">'+s.rows.map(r=>
      '<div class="axhe-row">'+
        '<div class="axhe-main"><div><b>'+esc(r.exercise)+'</b>'+editBadge(r)+'</div>'+
        '<div class="axhe-values">'+esc(r.weight)+(typeof r.weight==="number"?"kg":"")+'　'+esc(r.reps)+(r.reps!==""&&r.reps!=null?"回":"")+(r.sets?(' × '+esc(r.sets)+'set'):"")+'</div>'+
        (r.achieved?'<div class="axhe-meta">'+esc(r.achieved)+'</div>':"")+
        (r.memo?'<div class="axhe-memo">'+esc(r.memo)+'</div>':"")+'</div>'+
        '<button class="axhe-edit" onclick="axisOpenHistoryEditToken(\''+keyToken(r._axisKey)+'\')">編集</button>'+
      '</div>').join("")+'</div></div>';
}
window.histCard=axisHistCard;

function changesPanel(){
  const edits=loadEdits(),items=Object.entries(edits);
  if(!items.length)return '<div class="axhe-none">変更された過去記録はありません</div>';
  return '<details class="axhe-changes"><summary>変更・非表示した記録 <b>'+items.length+'件</b></summary>'+
    '<div class="axhe-changebody">'+items.map(([key,e])=>{
      const r=rawByKey(key);
      if(!r)return '<div class="axhe-change missing"><div>元記録を特定できません</div><button onclick="axisRestoreHistoryEditToken(\''+keyToken(key)+'\')">設定を削除</button></div>';
      const fields=e.deleted?["非表示"]:changedFields(r,e.patch||{});
      return '<div class="axhe-change"><div><b>'+esc(r.date)+'｜'+esc(r.client)+'</b><span>'+esc(r.exercise)+'</span><small>'+(e.deleted?"非表示":("変更: "+fields.join(" / ")))+'</small></div>'+
        '<button onclick="axisRestoreHistoryEditToken(\''+keyToken(key)+'\')">元に戻す</button></div>';
    }).join("")+
    '<button class="axhe-resetall" onclick="axisResetAllHistoryEdits()">すべての変更を元に戻す</button></div></details>';
}

window.renderHistory=function(){
  const root=S("#history");if(!root)return;
  root.innerHTML='<div class="axhe-title"><div><span class="ax16-eyebrow">HISTORY</span><h2>全履歴</h2></div></div>'+
    changesPanel()+
    '<div class="axhe-search"><span>⌕</span><input id="hq" placeholder="利用者・種目で検索"></div><div id="hlist"></div>';
  const draw=()=>{
    const q=S("#hq")?.value||"";
    const list=sessions().filter(s=>!q||s.client.includes(q)||s.rows.some(r=>String(r.exercise||"").includes(q))).slice(0,160);
    S("#hlist").innerHTML=list.length?list.map(axisHistCard).join(""):'<div class="axhe-empty">該当なし</div>';
  };
  draw();if(S("#hq"))S("#hq").oninput=draw;
};

function ensureModal(){
  if(S("#axisHistoryEditModal"))return;
  const m=document.createElement("div");m.id="axisHistoryEditModal";m.className="axhe-modal";m.innerHTML='<div class="axhe-dialog" role="dialog" aria-modal="true"><div id="axisHistoryEditBody"></div></div>';
  document.body.appendChild(m);
  m.addEventListener("click",e=>{if(e.target===m)axisCloseHistoryEdit()});
}
function currentView(){return document.querySelector(".view.on")?.id||"history"}

window.axisOpenHistoryEditToken=function(token){return axisOpenHistoryEdit(tokenKey(token))};
window.axisOpenHistoryEdit=function(key){
  ensureModal();
  const raw=rawByKey(key),edits=loadEdits(),e=edits[key]||{};
  if(!raw){alert("元の記録を特定できませんでした。");return}
  const row={...raw,...(e.patch||{})};
  editOrigin={view:currentView(),client:row.client||raw.client||""};
  const clients=typeof clientList==="function"?clientList().map(x=>x.name):[];
  S("#axisHistoryEditBody").innerHTML=
    '<div class="axhe-dialoghead"><div><span class="ax16-eyebrow">EDIT HISTORY</span><h3>過去記録を編集</h3></div><button onclick="axisCloseHistoryEdit()">×</button></div>'+
    '<div class="axhe-warning">元データは変更しません。修正内容だけをこの端末に保存します。</div>'+
    '<input type="hidden" id="axheKey" value="'+esc(key)+'">'+
    '<div class="axhe-form">'+
      '<label>日付<input id="axheDate" type="date" value="'+esc(row.date||"")+'"></label>'+
      '<label>利用者<input id="axheClient" list="axheClients" value="'+esc(row.client||"")+'"><datalist id="axheClients">'+clients.map(c=>'<option value="'+esc(c)+'">').join("")+'</datalist></label>'+
      '<label class="wide">種目<input id="axheExercise" value="'+esc(row.exercise||"")+'"></label>'+
      '<label>重量<input id="axheWeight" inputmode="decimal" value="'+esc(row.weight??"")+'" placeholder="自重も可"></label>'+
      '<label>回数<input id="axheReps" inputmode="numeric" value="'+esc(row.reps??"")+'"></label>'+
      '<label>セット<input id="axheSets" inputmode="numeric" value="'+esc(row.sets??"")+'"></label>'+
      '<label>達成・状態<input id="axheAchieved" value="'+esc(row.achieved||"")+'"></label>'+
      '<label class="wide">メモ<textarea id="axheMemo">'+esc(row.memo||"")+'</textarea></label>'+
    '</div>'+
    '<div class="axhe-actions"><button class="ax16-btn pri" onclick="axisSaveHistoryEdit()">変更を保存</button><button class="ax16-btn soft" onclick="axisRestoreHistoryEditToken(\''+keyToken(key)+'\')">元に戻す</button><button class="ax16-btn ghost danger" onclick="axisDeleteHistoryRowToken(\''+keyToken(key)+'\')">この記録を非表示</button></div>';
  document.body.classList.add("axis-history-modal-open");
  S("#axisHistoryEditModal").classList.add("on");
};

window.axisCloseHistoryEdit=function(){
  S("#axisHistoryEditModal")?.classList.remove("on");
  document.body.classList.remove("axis-history-modal-open");
};

function afterChange(preferredClient){
  axisCloseHistoryEdit();
  if(typeof renderAll==="function")renderAll();
  if(editOrigin.view==="detail"&&typeof openClient==="function")openClient(preferredClient||editOrigin.client);
  else{show("history",false);renderHistory()}
}

window.axisSaveHistoryEdit=function(){
  const key=S("#axheKey")?.value,raw=rawByKey(key);if(!key||!raw)return;
  const patch={
    date:S("#axheDate")?.value||raw.date,
    client:String(S("#axheClient")?.value||"").trim(),
    exercise:String(S("#axheExercise")?.value||"").trim(),
    weight:cleanNumber(S("#axheWeight")?.value,raw.weight),
    reps:cleanNumber(S("#axheReps")?.value,raw.reps),
    sets:cleanNumber(S("#axheSets")?.value,raw.sets),
    achieved:String(S("#axheAchieved")?.value||"").trim(),
    memo:String(S("#axheMemo")?.value||"")
  };
  if(!patch.date||!patch.client||!patch.exercise){alert("日付・利用者・種目は必須です。");return}
  const fields=changedFields(raw,patch),edits=loadEdits();
  if(fields.length)edits[key]={patch,updatedAt:new Date().toISOString()};
  else delete edits[key];
  saveEdits(edits);afterChange(patch.client);
};

window.axisDeleteHistoryRowToken=function(token){return axisDeleteHistoryRow(tokenKey(token))};
window.axisDeleteHistoryRow=function(key){
  const raw=rawByKey(key);if(!raw)return;
  if(!confirm("この記録をAXIS上で非表示にしますか？\n\n元データは削除されず、いつでも元に戻せます。"))return;
  const edits=loadEdits();edits[key]={...(edits[key]||{}),deleted:true,updatedAt:new Date().toISOString()};saveEdits(edits);
  afterChange(editOrigin.client||raw.client);
};

window.axisRestoreHistoryEditToken=function(token){return axisRestoreHistoryEdit(tokenKey(token))};
window.axisRestoreHistoryEdit=function(key){
  const edits=loadEdits();delete edits[key];saveEdits(edits);
  afterChange(editOrigin.client);
};
window.axisResetAllHistoryEdits=function(){
  if(!confirm("過去記録への編集・非表示をすべて元に戻しますか？\n\n元データ自体は変更されません。"))return;
  localStorage.removeItem(EDIT_KEY);afterChange(editOrigin.client);
};

ensureModal();
})();