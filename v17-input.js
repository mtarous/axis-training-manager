/* AXIS v17 training input
   iPhoneでスクロールせずに記録できる入力画面。
   - 利用者/日付/保存を常時表示
   - セットごとに重量・回数を持つ（ドロップセット対応）
   - 種目は自由入力で、保存時に種目リストへ自動登録
   既存のデータ構造(exercise/weight/reps/sets/done)は互換のまま残す。 */
(function(){
"use strict";

const REG_KEY="axis_exercise_registry_v1";
let activeIndex=0;
let memoMode="insight";

const el=s=>document.querySelector(s);
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const num=(v,d=0)=>{const x=parseFloat(v);return Number.isFinite(x)?x:d};
function round1(x){return Math.round(x*10)/10}

/* ---- 種目レジストリ（プルダウンに無い種目の自動登録） ---- */
function registry(){
  try{const a=JSON.parse(localStorage.getItem(REG_KEY));return Array.isArray(a)?a:[]}catch(e){return []}
}
function registerExercise(name){
  const x=String(name||"").trim(); if(!x) return;
  if(typeof exerciseList==="function"&&exerciseList().includes(x)) return;
  const a=registry(); if(a.includes(x)) return;
  a.push(x); localStorage.setItem(REG_KEY,JSON.stringify(a));
}
function allExercises(){
  const base=typeof exerciseList==="function"?exerciseList():[];
  return [...new Set([...base,...registry()])].sort((a,b)=>a.localeCompare(b,"ja"));
}
window.axisRegisterExercise=registerExercise;
window.axisExerciseRegistry=allExercises;

/* ---- セット構造 ---- */
/* steps: [{w,r}] 1要素=1セット。w は数値または "自重" */
function ensureSteps(e){
  if(!Array.isArray(e.steps)||!e.steps.length){
    const total=Math.max(1,num(e.sets,3));
    const w=String(e.weight)==="自重"?"自重":num(e.weight,0);
    e.steps=Array.from({length:total},()=>({w,r:num(e.reps,10)}));
  }
  e.steps=e.steps.map(s=>({w:String(s.w)==="自重"?"自重":num(s.w,0),r:Math.max(0,num(s.r,10))}));
  if(!Array.isArray(e.done)) e.done=[];
  e.done=e.done.filter(j=>j<e.steps.length);
  syncLegacy(e);
  return e.steps;
}
/* 旧フィールドを先頭セット基準で保つ（既存の分析・保存コードが参照するため） */
function syncLegacy(e){
  const s=e.steps[0]||{w:0,r:10};
  e.weight=s.w; e.reps=s.r; e.sets=e.steps.length;
}
function stepsSummary(e){
  const ws=[...new Set(e.steps.map(s=>String(s.w)))];
  return ws.length>1?"ドロップセット":"";
}

/* ---- 操作 ---- */
function focusIndex(i){
  if(!window.exs?.length){activeIndex=0;return 0}
  activeIndex=clamp(Number(i)||0,0,window.exs.length-1);
  return activeIndex;
}
function curEx(){return window.exs?.[focusIndex(activeIndex)]}
function refresh(){drawEx17();saveDraft()}

function bumpSetWeight(i,j,d){
  const e=window.exs?.[i]; if(!e) return; ensureSteps(e);
  const s=e.steps[j]; if(!s) return;
  if(String(s.w)==="自重") s.w=0;
  s.w=Math.max(0,round1(num(s.w,0)+d));
  syncLegacy(e); refresh();
}
function bumpSetReps(i,j,d){
  const e=window.exs?.[i]; if(!e) return; ensureSteps(e);
  const s=e.steps[j]; if(!s) return;
  s.r=Math.max(0,num(s.r,0)+d);
  syncLegacy(e); refresh();
}
function setBody(i,j){
  const e=window.exs?.[i]; if(!e) return; ensureSteps(e);
  const s=e.steps[j]; if(!s) return;
  s.w=String(s.w)==="自重"?0:"自重";
  syncLegacy(e); refresh();
}
/* もう1セット追加。delta を渡すと重量を段階的に下げ／上げて追加する */
function addStep(i,delta,ratio){
  const e=window.exs?.[i]; if(!e) return; ensureSteps(e);
  const last=e.steps[e.steps.length-1]||{w:0,r:10};
  let w=last.w;
  if(String(w)!=="自重"){
    if(Number.isFinite(ratio)) w=Math.max(0,round1(num(w,0)*ratio));
    else if(Number.isFinite(delta)) w=Math.max(0,round1(num(w,0)+delta));
  }
  e.steps.push({w,r:last.r});
  syncLegacy(e); refresh();
}
function removeStep(i,j){
  const e=window.exs?.[i]; if(!e) return; ensureSteps(e);
  if(e.steps.length<=1) return;
  e.steps.splice(j,1);
  e.done=e.done.filter(x=>x!==j).map(x=>x>j?x-1:x);
  syncLegacy(e); refresh();
}
function toggleStep(i,j){
  const e=window.exs?.[i]; if(!e) return; ensureSteps(e);
  const k=e.done.indexOf(j);
  if(k>=0) e.done.splice(k,1); else e.done.push(j);
  refresh();
  if(k<0&&typeof window.showSmartRest==="function") window.showSmartRest(i);
}
/* 次の未完了セットを記録 */
function recordNext(i){
  const e=window.exs?.[i]; if(!e) return; ensureSteps(e);
  const next=e.steps.findIndex((_,j)=>!e.done.includes(j));
  if(next<0) return;
  toggleStep(i,next);
  if(navigator.vibrate) navigator.vibrate(30);
}
function chooseEx17(i,v){
  const e=window.exs?.[i]; if(!e) return;
  e.exercise=String(v||"").trim();
  registerExercise(e.exercise);
  refresh();
}
function addExercise(){
  window.exs=window.exs||[];
  window.exs.push({exercise:"",steps:[{w:0,r:10}],done:[]});
  focusIndex(window.exs.length-1); refresh();
}
function removeExercise(i){
  if(!window.exs||window.exs.length<=1) return;
  window.exs.splice(i,1);
  focusIndex(Math.max(0,i-1)); refresh();
}
function prevRow(i){
  const c=el("#fclient")?.value||"", e=window.exs?.[i];
  if(!c||!e?.exercise||typeof latest!=="function") return null;
  const s=latest(c,el("#fdate")?.value||today());
  return s?.rows?.find(r=>r.exercise===e.exercise)||null;
}
/* 前回と同じ内容をこの種目に流し込む */
function usePrev(i){
  const p=prevRow(i), e=window.exs?.[i]; if(!p||!e) return;
  const total=Math.max(1,num(p.sets,3));
  const w=String(p.weight).includes("自重")?"自重":num(p.weight,0);
  e.steps=Array.from({length:total},()=>({w,r:num(p.reps,10)}));
  e.done=[]; syncLegacy(e); refresh();
}

function saveSession(){
  (window.exs||[]).forEach(e=>{ensureSteps(e);registerExercise(e.exercise)});
  saveDraft();
  if(typeof save==="function") save();
}

window.v17SetActive=i=>{focusIndex(i);drawEx17()};
window.v17BumpW=bumpSetWeight;
window.v17BumpR=bumpSetReps;
window.v17Body=setBody;
window.v17AddStep=addStep;
window.v17DropStep=(i,d)=>addStep(i,d,undefined);
window.v17DropRatio=(i,r)=>addStep(i,undefined,r);
window.v17RemoveStep=removeStep;
window.v17ToggleStep=toggleStep;
window.v17RecordNext=recordNext;
window.v17ChooseEx=chooseEx17;
window.v17AddExercise=addExercise;
window.v17RemoveExercise=removeExercise;
window.v17UsePrev=usePrev;
window.v17Save=saveSession;
window.v17Memo=function(mode){
  memoMode=mode;
  const t=el("#fnote"), src=el("#"+fieldId(mode)); if(!t||!src) return;
  t.value=src.value||""; t.placeholder=memoLabel(mode)+"を入力";
  document.querySelectorAll(".ax17-chips button").forEach(b=>b.classList.toggle("on",b.dataset.mode===mode));
  t.focus();
};
function fieldId(m){return m==="caution"?"fcaution":m==="share"?"fshare":"finsight"}
function memoLabel(m){return m==="caution"?"注意点":m==="share"?"共有事項":"気づき"}

/* ---- 描画 ---- */
window.drawEx17=function(){
  const root=el("#ax17-main"); if(!root) return;
  if(!window.exs?.length) addExercise();
  const i=focusIndex(activeIndex), e=window.exs[i], total=window.exs.length;
  ensureSteps(e);
  const done=e.done.length, sets=e.steps.length;
  const p=prevRow(i);
  const drop=stepsSummary(e);

  root.innerHTML=`
  <section class="ax17-card">
    <div class="ax17-exnav">
      <button type="button" ${i===0?"disabled":""} onclick="v17SetActive(${i-1})" aria-label="前の種目">‹</button>
      <div class="ax17-exmeta"><b>種目 ${i+1} / ${total}</b>${drop?`<span class="ax17-drop">${drop}</span>`:""}</div>
      <button type="button" ${i===total-1?"disabled":""} onclick="v17SetActive(${i+1})" aria-label="次の種目">›</button>
    </div>

    <input id="ax17-ex" class="ax17-exinput" list="ax17-exlist" placeholder="種目名（一覧にない名前も入力できます）"
           value="${esc(e.exercise||"")}" onchange="v17ChooseEx(${i},this.value)" autocomplete="off">
    <datalist id="ax17-exlist">${allExercises().map(x=>`<option value="${esc(x)}"></option>`).join("")}</datalist>

    <div class="ax17-prevline">
      ${p?`<span>前回 ${esc(p.weight)}${typeof p.weight==="number"?"kg":""} × ${esc(p.reps)}回 × ${esc(p.sets)}set</span>
           <button type="button" onclick="v17UsePrev(${i})">前回と同じにする</button>`
        :`<span>前回の記録なし</span>`}
    </div>

    <button class="ax17-record ${done>=sets?"full":""}" onclick="v17RecordNext(${i})" ${done>=sets?"disabled":""}>
      ${done>=sets?"この種目は完了":`SET ${done+1} を記録する`}
      <small>${done} / ${sets} セット完了</small>
    </button>

    <div class="ax17-sets">
      ${e.steps.map((s,j)=>{
        const isBody=String(s.w)==="自重";
        return `<div class="ax17-set ${e.done.includes(j)?"done":""} ${j===done?"next":""}">
          <button type="button" class="ax17-setno" onclick="v17ToggleStep(${i},${j})" aria-label="SET ${j+1}を切り替え">
            <b>${j+1}</b><i>${e.done.includes(j)?"✓":"○"}</i>
          </button>
          <div class="ax17-setval">
            <div class="ax17-pair">
              <button type="button" onclick="v17BumpW(${i},${j},-2.5)" aria-label="2.5kg減らす">−</button>
              <span class="ax17-w">${isBody?"自重":esc(s.w)+"<small>kg</small>"}</span>
              <button type="button" onclick="v17BumpW(${i},${j},2.5)" aria-label="2.5kg増やす">＋</button>
            </div>
            <div class="ax17-pair">
              <button type="button" onclick="v17BumpR(${i},${j},-1)" aria-label="1回減らす">−</button>
              <span class="ax17-r">${esc(s.r)}<small>回</small></span>
              <button type="button" onclick="v17BumpR(${i},${j},1)" aria-label="1回増やす">＋</button>
            </div>
          </div>
          <div class="ax17-setside">
            <button type="button" onclick="v17Body(${i},${j})" title="自重に切替">自重</button>
            <button type="button" onclick="v17RemoveStep(${i},${j})" title="このセットを削除" ${sets<=1?"disabled":""}>×</button>
          </div>
        </div>`;
      }).join("")}
    </div>

    <div class="ax17-addrow">
      <button type="button" class="pri" onclick="v17AddStep(${i})">＋ もう1セット</button>
      <button type="button" onclick="v17DropStep(${i},-5)">−5kgで追加</button>
      <button type="button" onclick="v17DropRatio(${i},0.8)">−20%で追加</button>
      <button type="button" onclick="v17DropStep(${i},5)">+5kgで追加</button>
    </div>

    <div class="ax17-exactions">
      <button type="button" onclick="v17AddExercise()">＋ 種目を追加</button>
      ${total>1?`<button type="button" onclick="v17RemoveExercise(${i})">この種目を削除</button>`:""}
    </div>
  </section>`;

  const bar=el("#ax17-progress");
  if(bar) bar.innerHTML=window.exs.map((x,k)=>{
    ensureSteps(x);
    const c=x.done.length>=x.steps.length?"done":x.done.length?"part":"";
    return `<button type="button" class="${c} ${k===i?"on":""}" onclick="v17SetActive(${k})" title="${esc(x.exercise||"種目"+(k+1))}"></button>`;
  }).join("");

  if(typeof window.showSmartRest==="function") window.showSmartRest(i);
  saveDraft();
};

window.renderInput=function(p={}){
  const cs=typeof clientList==="function"?clientList().map(x=>x.name):[];
  const src=p.exercises?.length?p.exercises:[{exercise:"",steps:[{w:0,r:10}],done:[]}];
  window.exs=src.map(x=>{const e={...x,done:Array.isArray(x.done)?[...x.done]:[]};ensureSteps(e);return e});
  focusIndex(activeIndex);

  el("#input").innerHTML=`
  <div class="ax17-shell">
    <div class="ax17-bar">
      <select id="fclient" aria-label="利用者"><option value="">利用者を選択</option>${cs.map(c=>`<option ${p.client===c?"selected":""}>${esc(c)}</option>`).join("")}</select>
      <input id="fdate" type="date" aria-label="日付" value="${p.date||today()}">
      <button id="ax17-save" onclick="v17Save()">保存</button>
    </div>
    <div id="ax17-progress" class="ax17-progress"></div>
    <div id="ax17-main"></div>
    <div id="smartRest"></div>

    <details class="ax17-more">
      <summary>セッションの詳細（RPE・痛み・40分タイマー）</summary>
      <div class="ax17-morebody">
        <div id="session40"><button class="ax16-btn soft full" onclick="startSession40()">40分セッション開始</button></div>
        <div class="ax17-selects">
          <label>状態<select id="fstatus">${["完了","良好","要確認","変更"].map(x=>`<option ${p.status===x?"selected":""}>${x}</option>`).join("")}</select></label>
          <label>RPE<select id="frpe"><option value="">-</option>${[1,2,3,4,5,6,7,8,9,10].map(x=>`<option ${String(p.rpe)===String(x)?"selected":""}>${x}</option>`).join("")}</select></label>
          <label>痛み<select id="fpain">${[0,1,2,3,4,5,6,7,8,9,10].map(x=>`<option ${String(p.pain)===String(x)?"selected":""}>${x}</option>`).join("")}</select></label>
        </div>
      </div>
    </details>

    <details class="ax17-more" open>
      <summary>メモ（気づき・注意点・共有事項・次回やること）</summary>
      <div class="ax17-morebody">
        <div class="ax17-chips">
          <button type="button" data-mode="insight" class="on" onclick="v17Memo('insight')">気づき</button>
          <button type="button" data-mode="caution" onclick="v17Memo('caution')">注意点</button>
          <button type="button" data-mode="share" onclick="v17Memo('share')">共有事項</button>
        </div>
        <input id="finsight" type="hidden" value="${esc(p.insight??p.note??"")}">
        <input id="fcaution" type="hidden" value="${esc(p.caution??(p.client?META.attention?.[p.client]||"":""))}">
        <input id="fshare" type="hidden" value="${esc(p.share??"")}">
        <textarea id="fnote" placeholder="気づきを入力">${esc(p.insight??p.note??"")}</textarea>
        <textarea id="fnext" placeholder="次回やること">${esc(p.next||"")}</textarea>
      </div>
    </details>
  </div>`;

  drawEx17();
  ["fdate","fclient","fstatus","frpe","fpain","fnext"].forEach(id=>{
    el("#"+id)?.addEventListener("input",()=>{saveDraft();if(id==="fclient"||id==="frpe")drawEx17()});
  });
  el("#fnote")?.addEventListener("input",()=>{
    const dst=el("#"+fieldId(memoMode)); if(dst){dst.value=el("#fnote").value;saveDraft()}
  });
  el("#fclient")?.addEventListener("change",()=>{
    const c=el("#fcaution");
    if(c&&!c.value) c.value=META.attention?.[el("#fclient").value]||"";
    saveDraft(); drawEx17();
  });
};

/* 既存コードからの drawEx 呼び出しを v17 に流す */
window.drawEx=function(){ if(el("#ax17-main")) drawEx17(); };
window.v16SetActive=window.v17SetActive;
window.v16RecordSet=i=>recordNext(i);
window.v16ClearSets=i=>{const e=window.exs?.[i];if(e){e.done=[];refresh()}};
window.v16FinishSession=saveSession;
window.toggleSet=(i,j)=>toggleStep(i,j);
window.changeSets=(i,d)=>{d>0?addStep(i):removeStep(i,(window.exs?.[i]?.steps?.length||1)-1)};
window.addEx=addExercise;
window.removeEx=removeExercise;

/* steps を履歴行へ展開する（同じ重量×回数が続く分はまとめて1行） */
window.axisExpandSteps=function(e){
  const steps=Array.isArray(e.steps)&&e.steps.length?e.steps:null;
  if(!steps) return [{exercise:e.exercise,weight:e.weight,reps:e.reps,sets:e.sets}];
  const out=[];
  for(const s of steps){
    const last=out[out.length-1];
    if(last&&String(last.weight)===String(s.w)&&String(last.reps)===String(s.r)) last.sets++;
    else out.push({exercise:e.exercise,weight:s.w,reps:s.r,sets:1});
  }
  return out;
};
})();
