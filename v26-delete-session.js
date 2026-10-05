/* AXIS v26 記録の削除
   保存は1セッションまるごとなのに、削除は種目1行ずつでしか出来なかった。
   - 保存した直後に「取り消す」を出す
   - 記録カードごと（＝保存した単位）で削除できるようにする
   - 削除した記録は30日間ゴミ箱に残し、履歴タブから戻せる
   data.enc の既存記録は触らない。消せるのはアプリで保存した分だけ。 */
(function(){
"use strict";

const TRASH_KEY="axis_training_trash_v1";
const TOMB_KEY="axis_training_deleted_v1";
const KEEP_DAYS=30;
const UNDO_SEC=30;

const S=s=>document.querySelector(s);
const esc2=v=>typeof esc==="function"?esc(v):String(v??"");

function tokenKey(token){
  let s=String(token||"").replace(/-/g,"+").replace(/_/g,"/");
  while(s.length%4)s+="=";
  try{return decodeURIComponent(escape(atob(s)))}catch(e){return ""}
}
function persist(){localStorage.setItem("axis_training_added",JSON.stringify(added))}

/* ---- ゴミ箱 ---- */
function loadTrash(){
  try{const a=JSON.parse(localStorage.getItem(TRASH_KEY)||"[]");return Array.isArray(a)?a:[]}catch(e){return[]}
}
function saveTrash(a){
  if(a.length)localStorage.setItem(TRASH_KEY,JSON.stringify(a));
  else localStorage.removeItem(TRASH_KEY);
}
/* 削除した印。同期やバックアップ取り込みで復活しないように残す */
function loadTombs(){
  try{const x=JSON.parse(localStorage.getItem(TOMB_KEY)||"{}");return x&&typeof x==="object"&&!Array.isArray(x)?x:{}}catch(e){return{}}
}
function saveTombs(x){
  if(Object.keys(x).length)localStorage.setItem(TOMB_KEY,JSON.stringify(x));
  else localStorage.removeItem(TOMB_KEY);
}
/* 削除済みの記録が混ざっていたら取り除く */
function reconcile(){
  const tombs=loadTombs();
  if(!Object.keys(tombs).length)return false;
  const list=Array.isArray(added)?added:[];
  const keep=list.filter(s=>!(s?.savedAt&&tombs[s.savedAt]));
  if(keep.length===list.length)return false;
  added=keep; persist();
  return true;
}
window.axisReconcileDeleted=reconcile;

/* 30日を過ぎたものは捨てる */
function purge(){
  const limit=Date.now()-KEEP_DAYS*86400000;
  const a=loadTrash().filter(x=>{
    const t=Date.parse(x?.deletedAt||"");
    return Number.isFinite(t)?t>=limit:true;
  });
  saveTrash(a);
  return a;
}

/* ---- 削除・復元 ---- */
function removeByStamps(stamps){
  const set=new Set(stamps.filter(Boolean));
  if(!set.size) return [];
  const keep=[],gone=[];
  (Array.isArray(added)?added:[]).forEach(s=>{(set.has(s?.savedAt)?gone:keep).push(s)});
  if(!gone.length) return [];
  added=keep; persist();
  const trash=purge(),tombs=loadTombs();
  const at=new Date().toISOString();
  gone.forEach(s=>{trash.unshift({session:s,deletedAt:at});if(s?.savedAt)tombs[s.savedAt]=at});
  saveTrash(trash); saveTombs(tombs);
  return gone;
}
function redraw(){
  if(typeof renderAll==="function")renderAll();
  if(typeof renderHistory==="function"&&S("#history")?.classList.contains("on"))renderHistory();
  decorate();
}

window.axisDeleteSession=function(token){
  const stamps=String(token||"").split(",").map(tokenKey).filter(Boolean);
  const target=(Array.isArray(added)?added:[]).filter(s=>stamps.includes(s?.savedAt));
  if(!target.length){alert("この記録は削除できません。種目ごとの「編集」から非表示にしてください。");return}
  const n=target.reduce((a,s)=>a+(s.exercises?.length||0),0);
  const s0=target[0];
  if(!confirm(s0.date+"｜"+s0.client+" の記録（"+n+"種目）を削除しますか？\n\n30日間はゴミ箱から戻せます。"))return;
  removeByStamps(stamps);
  hideUndo();
  redraw();
};

window.axisRestoreSession=function(deletedAt,savedAt){
  const trash=purge();
  const i=trash.findIndex(x=>x.deletedAt===deletedAt&&x.session?.savedAt===savedAt);
  if(i<0)return;
  const [item]=trash.splice(i,1);
  saveTrash(trash);
  const tombs=loadTombs(); delete tombs[item.session?.savedAt]; saveTombs(tombs);
  added=[item.session,...(Array.isArray(added)?added:[])];
  persist();
  redraw();
};

window.axisEmptyTrash=function(){
  const n=purge().length;
  if(!n)return;
  if(!confirm("ゴミ箱の"+n+"件を完全に削除しますか？\n\nこの操作は元に戻せません。"))return;
  saveTrash([]);
  redraw();
};

/* ---- 保存直後の取り消し ---- */
let undoTimer=null;

function hideUndo(){
  if(undoTimer){clearTimeout(undoTimer);undoTimer=null}
  S("#ax26-undo")?.remove();
}
function showUndo(stamp,label){
  hideUndo();
  const box=document.createElement("div");
  box.id="ax26-undo";
  box.className="ax26-undo";
  box.innerHTML='<span>保存しました<small>'+esc2(label)+'</small></span>'+
    '<button type="button" onclick="axisUndoSave(\''+esc2(stamp)+'\')">取り消す</button>'+
    '<button type="button" class="ax26-close" onclick="axisHideUndo()" aria-label="閉じる">×</button>';
  (typeof window.axisDock==="function"?window.axisDock():document.body).prepend(box);
  undoTimer=setTimeout(hideUndo,UNDO_SEC*1000);
}
window.axisHideUndo=hideUndo;
window.axisUndoSave=function(stamp){
  if(!removeByStamps([stamp]).length){hideUndo();return}
  hideUndo();
  redraw();
  if(typeof show==="function")show("history",true);
  if(typeof renderHistory==="function")renderHistory();
  decorate();
};

const baseSave=window.save;
if(typeof baseSave==="function"){
  window.save=function(){
    const before=(Array.isArray(added)?added:[]).length;
    const realAlert=window.alert;
    window.alert=m=>{if(String(m).indexOf("保存しました")>=0)return;realAlert(m)};
    try{ baseSave.apply(this,arguments) }finally{ window.alert=realAlert }
    const now=Array.isArray(added)?added:[];
    if(now.length>before&&now[0]?.savedAt){
      showUndo(now[0].savedAt,now[0].date+"｜"+now[0].client);
      decorate();
    }
  };
}

/* ---- カードに削除ボタンを足す ---- */
function stampsOfCard(card){
  const out=[];
  card.querySelectorAll(".axhe-edit").forEach(b=>{
    const m=/axisOpenHistoryEditToken\('([^']+)'\)/.exec(b.getAttribute("onclick")||"");
    if(!m)return;
    let key;
    try{key=JSON.parse(tokenKey(m[1]))}catch(e){return}
    if(Array.isArray(key)&&key[0]==="app-v2"&&key[1]&&out.indexOf(key[1])<0)out.push(key[1]);
  });
  return out;
}
function b64url(s){
  return btoa(unescape(encodeURIComponent(String(s||"")))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
}
function decorate(){
  document.querySelectorAll(".axhe-card").forEach(card=>{
    if(card.querySelector(".ax26-del"))return;
    const stamps=stampsOfCard(card);
    if(!stamps.length)return;
    const head=card.querySelector(".axhe-cardhead");
    if(!head)return;
    const b=document.createElement("button");
    b.className="ax26-del";
    b.type="button";
    b.textContent="この記録を削除";
    b.setAttribute("onclick","axisDeleteSession('"+stamps.map(b64url).join(",")+"')");
    head.appendChild(b);
  });
}
window.axisDecorateDelete=decorate;

/* ---- 履歴タブのゴミ箱 ---- */
function trashPanel(){
  const items=purge();
  if(!items.length)return"";
  return '<details class="ax26-trash"><summary>ゴミ箱 <b>'+items.length+'件</b><small>30日で自動的に消えます</small></summary><div class="ax26-trashbody">'+
    items.map(x=>{
      const s=x.session||{};
      const n=(s.exercises||[]).length;
      return '<div class="ax26-trashrow"><div><b>'+esc2(s.date)+'｜'+esc2(s.client)+'</b><span>'+n+'種目</span></div>'+
        '<button type="button" onclick="axisRestoreSession(\''+esc2(x.deletedAt)+'\',\''+esc2(s.savedAt)+'\')">戻す</button></div>';
    }).join("")+
    '<button type="button" class="ax26-empty" onclick="axisEmptyTrash()">ゴミ箱を空にする</button></div></details>';
}

const baseRenderHistory=window.renderHistory;
if(typeof baseRenderHistory==="function"){
  window.renderHistory=function(){
    baseRenderHistory.apply(this,arguments);
    const root=S("#history");
    if(root&&!root.querySelector(".ax26-trash")){
      const html=trashPanel();
      if(html){
        const anchor=root.querySelector(".axhe-search")||root.firstElementChild;
        if(anchor)anchor.insertAdjacentHTML("beforebegin",html);
      }
    }
    decorate();
  };
}
const baseOpenClient=window.openClient;
if(typeof baseOpenClient==="function"){
  window.openClient=function(){const r=baseOpenClient.apply(this,arguments);decorate();return r};
}

/* 同期・バックアップ取り込みのあとに削除済みが戻らないようにする */
const baseRenderAll=window.renderAll;
if(typeof baseRenderAll==="function"){
  window.renderAll=function(){reconcile();return baseRenderAll.apply(this,arguments)};
}
const baseBuildBackup=window.axisBuildBackup;
if(typeof baseBuildBackup==="function"){
  window.axisBuildBackup=function(){
    const b=baseBuildBackup.apply(this,arguments)||{};
    const tombs=loadTombs();
    if(Array.isArray(b.sessions))b.sessions=b.sessions.filter(s=>!(s?.savedAt&&tombs[s.savedAt]));
    return b;
  };
}

purge(); reconcile();
document.addEventListener("DOMContentLoaded",decorate);
setTimeout(decorate,0);
})();
