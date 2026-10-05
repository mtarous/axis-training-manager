/* AXIS v25
   1) 休憩タイマーを画面下に常駐させ、一時停止・停止・±30秒ができるようにする
   2) 重量の刻みを選べるようにし、数字をタップして任意の値（3kg・7kgなど）を直接入れられるようにする */
(function(){
"use strict";

const el=s=>document.querySelector(s);
const num=(v,d=0)=>{const x=parseFloat(v);return Number.isFinite(x)?x:d};
const round1=x=>Math.round(x*10)/10;
const mmss=s=>Math.floor(Math.max(0,s)/60)+":"+String(Math.floor(Math.max(0,s)%60)).padStart(2,"0");

/* ---- 休憩タイマー ---- */
let left=0,total=0,id=null,running=false;

function bar(){
  let b=el("#ax25-rest");
  if(b) return b;
  b=document.createElement("div");
  b.id="ax25-rest";
  b.className="ax25-rest";
  b.hidden=true;
  b.innerHTML=`
    <div class="ax25-rest-head">
      <b id="ax25-rest-time">0:00</b>
      <span id="ax25-rest-state">休憩中</span>
      <div class="ax25-rest-track"><i id="ax25-rest-fill"></i></div>
    </div>
    <div class="ax25-rest-btns">
      <button type="button" id="ax25-rest-pause" class="ax25-main" onclick="axisRest.toggle()">一時停止</button>
      <button type="button" onclick="axisRest.add(30)">＋30秒</button>
      <button type="button" class="ax25-stop" onclick="axisRest.stop()">停止</button>
    </div>`;
  document.body.appendChild(b);
  return b;
}

function paint(){
  const b=bar();
  b.hidden=false;
  document.body.classList.add("ax25-resting");
  b.classList.toggle("paused",!running);
  b.classList.toggle("zero",left<=0);
  const t=el("#ax25-rest-time");      if(t) t.textContent=mmss(left);
  const s=el("#ax25-rest-state");     if(s) s.textContent=left<=0?"休憩おわり":(running?"休憩中":"一時停止中");
  const f=el("#ax25-rest-fill");      if(f) f.style.width=(total>0?Math.max(0,Math.min(100,left/total*100)):0)+"%";
  const p=el("#ax25-rest-pause");     if(p) p.textContent=running?"一時停止":"再開";
  const legacy=el("#timerText");
  if(legacy) legacy.textContent=left>0?mmss(left):"0:00";
}

function clear(){ if(id){clearInterval(id);id=null} }

function tickDown(){
  left--;
  if(left<=0){
    left=0; running=false; clear();
    if(navigator.vibrate) navigator.vibrate([200,100,200]);
  }
  paint();
}

function start(sec){
  clear();
  total=Math.max(1,num(sec,60));
  left=total;
  running=true;
  paint();
  id=setInterval(tickDown,1000);
}

window.axisRest={
  start,
  toggle(){
    if(left<=0){ start(total||60); return }
    running=!running;
    clear();
    if(running) id=setInterval(tickDown,1000);
    paint();
  },
  add(d){
    if(left<=0&&d<0) return;
    left=Math.max(0,left+d);
    total=Math.max(total,left);
    if(left>0&&!running){ /* 停止中に足したら時間だけ伸ばす */ }
    paint();
  },
  stop(){
    clear(); running=false; left=0; total=0;
    const b=el("#ax25-rest"); if(b) b.hidden=true;
    document.body.classList.remove("ax25-resting");
    const legacy=el("#timerText"); if(legacy) legacy.textContent="休憩タイマー";
  }
};

/* 既存の startTimer（index.html / v16-train）を置き換える */
window.startTimer=function(sec){ start(sec) };
window.stopTimer=window.axisRest.stop;

/* ---- 重量の刻み・直接入力 ---- */
const STEPS=[1,2.5,5];
function stepOf(e){ const s=num(e&&e.wStep,2.5); return STEPS.includes(s)?s:2.5 }

window.v25SetStep=function(i,s){
  const e=window.exs&&window.exs[i]; if(!e) return;
  e.wStep=num(s,2.5);
  if(typeof window.drawEx17==="function") window.drawEx17();
};

/* 数字をタップして直接入れる */
function inlineEdit(span,cur,commit){
  if(span.querySelector("input")) return;
  const input=document.createElement("input");
  input.type="text";
  input.inputMode="decimal";
  input.className="ax25-inline";
  input.value=String(cur);
  span.innerHTML="";
  span.appendChild(input);
  input.focus();
  input.select();
  let closed=false;
  const done=ok=>{
    if(closed) return; closed=true;
    const v=num(input.value,NaN);
    if(ok&&Number.isFinite(v)) commit(Math.max(0,round1(v)));
    else if(typeof window.drawEx17==="function") window.drawEx17();
  };
  input.addEventListener("blur",()=>done(true));
  input.addEventListener("keydown",ev=>{
    if(ev.key==="Enter"){ev.preventDefault();done(true)}
    if(ev.key==="Escape"){ev.preventDefault();done(false)}
  });
}

/* drawEx17 の後に、刻みの選択行と直接入力を足す */
function decorate(){
  const root=el("#ax17-main"); if(!root||!window.exs?.length) return;
  const rec=root.querySelector(".ax17-record");
  const m=/v17RecordNext\((\d+)\)/.exec(rec?.getAttribute("onclick")||"");
  const idx=m?Math.min(Number(m[1]),window.exs.length-1):0;
  const e=window.exs[idx]; if(!e) return;
  const step=stepOf(e);

  const addrow=root.querySelector(".ax17-addrow");
  if(addrow&&!root.querySelector(".ax25-steprow")){
    const row=document.createElement("div");
    row.className="ax25-steprow";
    row.innerHTML=`<span class="ax25-steplabel">刻み</span>`
      +STEPS.map(s=>`<button type="button" class="${s===step?"on":""}" onclick="v25SetStep(${idx},${s})">${s}kg</button>`).join("")
      +`<span class="ax25-stephint">数字をタップすると直接入力</span>`;
    addrow.parentNode.insertBefore(row,addrow);
  }

  /* ＋−ボタンを選んだ刻みに差し替える */
  root.querySelectorAll(".ax17-set").forEach((rowEl,j)=>{
    const pair=rowEl.querySelector(".ax17-pair");
    if(!pair) return;
    const btns=pair.querySelectorAll("button");
    if(btns[0]){
      btns[0].setAttribute("aria-label",step+"kg減らす");
      btns[0].onclick=()=>window.v17BumpW(idx,j,-step);
    }
    if(btns[1]){
      btns[1].setAttribute("aria-label",step+"kg増やす");
      btns[1].onclick=()=>window.v17BumpW(idx,j,step);
    }
    const w=rowEl.querySelector(".ax17-w");
    if(w&&!w.dataset.ax25){
      w.dataset.ax25="1";
      w.classList.add("ax25-tap");
      w.addEventListener("click",()=>{
        const st=window.exs?.[idx]?.steps?.[j]; if(!st) return;
        const cur=String(st.w)==="自重"?0:num(st.w,0);
        inlineEdit(w,cur,v=>window.v17BumpW(idx,j,v-(String(st.w)==="自重"?0:num(st.w,0))));
      });
    }
    const r=rowEl.querySelector(".ax17-r");
    if(r&&!r.dataset.ax25){
      r.dataset.ax25="1";
      r.classList.add("ax25-tap");
      r.addEventListener("click",()=>{
        const st=window.exs?.[idx]?.steps?.[j]; if(!st) return;
        const cur=num(st.r,0);
        inlineEdit(r,cur,v=>window.v17BumpR(idx,j,Math.round(v)-cur));
      });
    }
  });

  /* 「−5kgで追加／+5kgで追加」も刻みに合わせる */
  if(addrow){
    addrow.querySelectorAll("button").forEach(b=>{
      const t=b.textContent||"";
      if(!/kgで追加$/.test(t)) return;
      if(t.charAt(0)==="−"){ b.textContent="−"+step+"kgで追加"; b.onclick=()=>window.v17DropStep(idx,-step) }
      else{ b.textContent="+"+step+"kgで追加"; b.onclick=()=>window.v17DropStep(idx,step) }
    });
  }
}

const baseDraw=window.drawEx17;
if(typeof baseDraw==="function"){
  window.drawEx17=function(){ baseDraw.apply(this,arguments); try{decorate()}catch(err){} };
  window.drawEx=function(){ if(el("#ax17-main")) window.drawEx17() };
}
})();
