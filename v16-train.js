/* AXIS v16 training screen
   Presentation layer only. Existing data/save functions are reused. */
(function(){
"use strict";

let activeIndex = 0;
let restTotal = 0;
let memoMode = "insight";

function el(s){ return document.querySelector(s); }
function clamp(n,min,max){ return Math.max(min,Math.min(max,n)); }
function mmss(sec){
  sec=Math.max(0,Math.round(Number(sec)||0));
  return `${Math.floor(sec/60)}:${String(sec%60).padStart(2,"0")}`;
}
function currentClient(){ return el("#fclient")?.value || ""; }
function currentRpe(){ return Number(el("#frpe")?.value || 0); }

function exTags(name){
  const muscles=(typeof musclesForExercise==="function"?musclesForExercise(name):[]).filter(x=>x!=="全身");
  const n=String(name||"");
  const region=/スクワット|レッグ|ランジ|ブルガリアン|デッド|RDL|ヒップ|カーフ|ジャンプ|ホップ/i.test(n)?"下半身":
    /ベンチ|チェスト|プレス|ロー|ラット|プル|カール|レイズ|懸垂/i.test(n)?"上半身":
    /クランチ|腹|プランク|体幹/i.test(n)?"体幹":"全身";
  const tool=/ダンベル/i.test(n)?"ダンベル":/バーベル|ベンチ|スクワット|デッド/i.test(n)?"フリーウェイト":
    /マシン|プレス|カール|エクステンション|プルダウン/i.test(n)?"マシン":"トレーニング";
  return [...new Set([muscles[0],region,tool].filter(Boolean))];
}
function previousRow(i){
  const c=currentClient(), e=window.exs?.[i];
  if(!c||!e?.exercise) return null;
  const before=el("#fdate")?.value||today();
  const s=latest(c,before);
  return s?.rows?.find(r=>r.exercise===e.exercise)||null;
}
function focusIndex(i){
  if(!window.exs?.length){ activeIndex=0; return 0; }
  activeIndex=clamp(Number(i)||0,0,window.exs.length-1);
  return activeIndex;
}
function bumpWeight(i,delta){
  const e=window.exs?.[i]; if(!e) return;
  if(String(e.weight)==="自重") e.weight=0;
  e.weight=Math.max(0,Math.round((Number(e.weight||0)+Number(delta))*10)/10);
  drawEx(); saveDraft();
}
function stepRpe(d){
  const s=el("#frpe"); if(!s) return;
  s.value=String(clamp(Number(s.value||0)+d,1,10));
  saveDraft(); drawEx();
}
function clearSets(i){
  const e=window.exs?.[i]; if(!e) return;
  e.done=[]; drawEx(); saveDraft();
  renderRest(i);
}
function recordSet(i){
  const e=window.exs?.[i]; if(!e) return;
  const total=Math.max(1,Number(e.sets)||1);
  const next=Array.from({length:total},(_,j)=>j).find(j=>!e.done.includes(j));
  if(next===undefined) return;
  toggleSet(i,next);
}
function memoFieldId(mode){ return mode==="caution"?"fcaution":mode==="share"?"fshare":"finsight"; }
function memoLabel(mode){ return mode==="caution"?"注意点":mode==="share"?"共有事項":"気づき"; }
function quickMemo(mode){
  memoMode=mode;
  const t=el("#fnote"), src=el("#"+memoFieldId(mode)); if(!t||!src) return;
  t.value=src.value||"";
  t.placeholder=memoLabel(mode)+"を入力";
  document.querySelectorAll(".ax16t-chips button").forEach(b=>b.classList.toggle("on",b.dataset.mode===mode));
  t.focus();
}
function syncMemo(){
  const t=el("#fnote"), dst=el("#"+memoFieldId(memoMode)); if(!t||!dst) return;
  dst.value=t.value;
  saveDraft();
}
function openHistory(){
  const c=currentClient();
  if(c) openClient(c);
}
function finishSession(){ save(); }

function restRange(sec){
  return [Math.max(45,sec-30),Math.min(240,sec+30)];
}
function renderRest(i){
  const box=el("#smartRest"), e=window.exs?.[i];
  if(!box||!e) return;
  const sec=typeof smartRestSeconds==="function"?smartRestSeconds(e,currentClient(),currentRpe()):90;
  const [lo,hi]=restRange(sec);
  const circumference=2*Math.PI*46;
  box.innerHTML=`<div class="ax16t-restcard">
    <div class="ax16t-resthead"><div><span class="ax16-eyebrow">SMART REST</span><h3>スマート休憩</h3></div>
      <span class="ax16t-restmeta">推奨 ${mmss(sec)}<br>範囲 ${mmss(lo)}–${mmss(hi)}</span></div>
    <div class="ax16t-restbody">
      <div class="ax16t-ring" data-total="${sec}">
        <svg viewBox="0 0 110 110"><circle class="bg" cx="55" cy="55" r="46"/><circle class="fg" cx="55" cy="55" r="46" stroke-dasharray="${circumference.toFixed(2)}" stroke-dashoffset="0"/></svg>
        <div class="ax16t-ringtext"><b id="timerText">${mmss(sec)}</b><span>REST</span></div>
      </div>
      <div class="ax16t-restcopy">${esc(e.exercise||"種目")}・${esc(e.reps)}回${currentRpe()?`・RPE ${currentRpe()}`:""}を基準に算出。</div>
    </div>
    <button class="ax16-btn pri full" onclick="v16StartRest(${i})">${typeof v16Icon==="function"?v16Icon("clock"):""}休憩スタート</button>
  </div>`;
}
function startRest(i){
  const e=window.exs?.[i]; if(!e) return;
  const sec=typeof smartRestSeconds==="function"?smartRestSeconds(e,currentClient(),currentRpe()):90;
  restTotal=sec;
  startTimer(sec);
}
window.showSmartRest=function(i){ renderRest(i); };

const oldTick=window.tick;
window.tick=function(){
  if(typeof timerLeft!=="undefined"){
    const txt=el("#timerText");
    if(txt) txt.textContent=timerLeft>0?mmss(timerLeft):"0:00";
    const ring=el(".ax16t-ring .fg");
    if(ring&&restTotal>0){
      const c=2*Math.PI*46;
      const pct=clamp(timerLeft/restTotal,0,1);
      ring.style.strokeDashoffset=String(c*(1-pct));
    }
    if(timerLeft<=0) restTotal=0;
    return;
  }
  if(typeof oldTick==="function") oldTick();
};

window.v16SetActive=function(i){ focusIndex(i); drawEx(); renderRest(activeIndex); };
window.v16BumpWeight=bumpWeight;
window.v16StepRpe=stepRpe;
window.v16ClearSets=clearSets;
window.v16RecordSet=recordSet;
window.v16QuickMemo=quickMemo;
window.v16OpenHistory=openHistory;
window.v16FinishSession=finishSession;
window.v16StartRest=startRest;

window.renderInput=function(p={}){
  const cs=clientList().map(x=>x.name);
  const ex=p.exercises||[{exercise:"",weight:0,weightStep:1,reps:10,sets:3,done:[]}];
  window.exs=ex.map(x=>({...x,weight:normalizeWeight(x.weight),weightStep:x.weightStep||inferWeightStep(x.weight),done:Array.isArray(x.done)?x.done:[]}));
  focusIndex(activeIndex);
  el("#input").innerHTML=`
    <div class="ax16t-shell">
      <div class="ax16t-topbar">
        <div><span class="ax16-eyebrow">LIVE SESSION</span><h2>トレーニング</h2></div>
        <button class="ax16t-end" onclick="v16FinishSession()">セッション終了</button>
      </div>

      <section class="ax16t-session ax16-panel">
        <div class="ax16t-clientline">
          <select id="fclient" class="ax16t-client"><option value="">利用者を選択</option>${cs.map(c=>`<option ${p.client===c?"selected":""}>${esc(c)}</option>`).join("")}</select>
          <input id="fdate" class="ax16t-date" type="date" value="${p.date||today()}">
        </div>
        <div id="session40" class="ax16t-sessionclock"><button class="ax16-btn soft full" onclick="startSession40()">40分セッション開始</button></div>
        <div class="ax16t-statusrow">
          <select id="fstatus"><option ${p.status==="完了"?"selected":""}>完了</option><option ${p.status==="良好"?"selected":""}>良好</option><option ${p.status==="要確認"?"selected":""}>要確認</option><option ${p.status==="変更"?"selected":""}>変更</option></select>
          <label class="ax16t-rpe">RPE <button type="button" onclick="v16StepRpe(-1)">−</button><select id="frpe"><option value="">-</option>${[1,2,3,4,5,6,7,8,9,10].map(x=>`<option ${String(p.rpe)===String(x)?"selected":""}>${x}</option>`).join("")}</select><button type="button" onclick="v16StepRpe(1)">＋</button></label>
          <label class="ax16t-pain">痛み<select id="fpain">${[0,1,2,3,4,5,6,7,8,9,10].map(x=>`<option ${String(p.pain)===String(x)?"selected":""}>${x}</option>`).join("")}</select></label>
        </div>
      </section>

      <div id="editors"></div>
      <div id="smartRest"></div>

      <section class="ax16-panel ax16t-memo">
        <div class="ax16-head"><div class="ax16-h"><span class="ic">${typeof v16Icon==="function"?v16Icon("note"):""}</span>クイックメモ</div></div>
        <div class="ax16t-chips">
          <button type="button" data-mode="insight" class="on" onclick="v16QuickMemo('insight')">気づき</button>
          <button type="button" data-mode="caution" onclick="v16QuickMemo('caution')">注意点</button>
          <button type="button" data-mode="share" onclick="v16QuickMemo('share')">共有事項</button>
        </div>
        <input id="finsight" type="hidden" value="${esc(p.insight??p.note??"")}">
        <input id="fcaution" type="hidden" value="${esc(p.caution??"")}">
        <input id="fshare" type="hidden" value="${esc(p.share??"")}">
        <textarea id="fnote" placeholder="気づきを入力">${esc(p.insight??p.note??"")}</textarea>
        <textarea id="fnext" placeholder="次回やること">${esc(p.next||"")}</textarea>
      </section>
    </div>`;
  drawEx();
  ["fdate","fclient","fstatus","frpe","fpain","fnext"].forEach(id=>{
    const x=el("#"+id);
    if(x) x.addEventListener("input",()=>{ saveDraft(); if(id==="fclient"||id==="frpe"){drawEx();renderRest(activeIndex);} });
  });
  el("#fnote")?.addEventListener("input",syncMemo);
  renderRest(activeIndex);
};

window.drawEx=function(){
  const root=el("#editors"); if(!root) return;
  if(!window.exs?.length){ root.innerHTML=""; return; }
  const i=focusIndex(activeIndex), e=window.exs[i], total=window.exs.length;
  const isBody=String(e.weight)==="自重", prev=previousRow(i), tags=exTags(e.exercise);
  const muscles=typeof muscleMap==="function"?muscleMap([e],{chips:false}):"";
  const doneCount=e.done.filter(j=>j<Number(e.sets||0)).length;
  root.innerHTML=`
    <section class="ax16-panel ax16t-ex">
      <div class="ax16t-progresshead">
        <div><span class="ax16-eyebrow">CURRENT EXERCISE</span><b>現在の種目 ${i+1} / ${total}</b></div>
        <div class="ax16t-arrows">
          <button type="button" ${i===0?"disabled":""} onclick="v16SetActive(${i-1})">‹</button>
          <button type="button" ${i===total-1?"disabled":""} onclick="v16SetActive(${i+1})">›</button>
        </div>
      </div>

      <div class="ax16t-exhead">
        <div>
          <select class="exercise-select ax16t-exselect" onchange="chooseExercise(${i},this.value)">${exerciseOptions(e.exercise)}</select>
          <div class="ax16t-tags">${tags.map(t=>`<span>${esc(t)}</span>`).join("")}</div>
        </div>
        <div class="ax16t-mini">${muscles}</div>
      </div>

      <div class="ax16t-metrics">
        <div class="ax16t-metric">
          <span>重量</span>
          ${isBody?`<b>自重</b><div class="ax16t-weightchips"><button onclick="setWeightDirect(${i},0)">数値に戻す</button></div>`:
          `<b>${esc(e.weight)}<small>kg</small></b>
           <div class="ax16t-weightchips">
            <button onclick="v16BumpWeight(${i},-1)">−1</button><button onclick="v16BumpWeight(${i},-0.5)">−0.5</button>
            <button onclick="v16BumpWeight(${i},0.5)">＋0.5</button><button onclick="v16BumpWeight(${i},1)">＋1</button>
           </div>`}
          <button class="ax16t-bodybtn" onclick="setBodyWeight(${i})">自重</button>
        </div>
        <div class="ax16t-metric"><span>回数</span><div class="ax16t-step"><button onclick="stepR(${i},-1)">−</button><b>${esc(e.reps)}</b><button onclick="stepR(${i},1)">＋</button></div></div>
        <div class="ax16t-metric"><span>セット</span><div class="ax16t-step"><button onclick="changeSets(${i},-1)">−</button><b>${esc(e.sets)}</b><button onclick="changeSets(${i},1)">＋</button></div></div>
      </div>

      <div class="ax16t-prev">
        <div><span class="ax16-eyebrow">PREVIOUS</span><b>前回の結果</b></div>
        <div class="ax16t-prevval">${prev?`${esc(prev.weight)}${typeof prev.weight==="number"?"kg":""} × ${esc(prev.reps)}回 × ${esc(prev.sets)}set`:"前回記録なし"}</div>
        <button type="button" onclick="v16OpenHistory()">履歴を表示</button>
      </div>

      <div class="ax16t-recordrow">
        <button class="ax16-btn pri" onclick="v16RecordSet(${i})">このセットを記録する</button>
        <button class="ax16-btn ghost" onclick="v16ClearSets(${i})">セットをクリア</button>
      </div>

      <div class="ax16t-setstatus">
        <div class="ax16t-settitle"><b>セット状況 ${doneCount}/${e.sets}</b><span>${doneCount===Number(e.sets)?"完了":"進行中"}</span></div>
        <div class="ax16t-setlist">${Array.from({length:Number(e.sets)||1},(_,j)=>`<button class="${e.done.includes(j)?"done":""}" onclick="toggleSet(${i},${j})"><span>SET ${j+1}</span><b>${esc(e.weight)}${typeof e.weight==="number"?"kg":""} × ${esc(e.reps)}回</b><i>${e.done.includes(j)?"✓":"○"}</i></button>`).join("")}</div>
      </div>

      <div class="ax16t-exactions">
        <button class="ax16-btn soft" onclick="addEx();v16SetActive(exs.length-1)">＋ 種目を追加</button>
        ${total>1?`<button class="ax16-btn ghost" onclick="removeEx(${i});v16SetActive(Math.max(0,${i}-1))">この種目を削除</button>`:""}
      </div>
    </section>`;
  renderRest(i);
};

})();
