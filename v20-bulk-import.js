/* AXIS v20 まとめて入力（貼り付け取り込み）
   手書きメモのような文章を貼り付けて、複数利用者・複数日のセッションを一度に作る。
   取り込む前に必ず一覧で確認できるようにする。 */
(function(){
"use strict";

/* ---- 文字の正規化 ---- */
function normalize(s){
  return String(s||"")
    .replace(/[０-９]/g,c=>String.fromCharCode(c.charCodeAt(0)-0xFEE0))  /* 全角数字 */
    .replace(/[ａ-ｚ]/g,c=>String.fromCharCode(c.charCodeAt(0)-0xFEE0))
    .replace(/[　\t]/g," ")
    .replace(/[（）]/g,m=>m==="（"?"(":")")
    .replace(/[，､]/g,"、")
    .replace(/[ｘⅹ✕✖]/g,"×");
}
function toHalfDigits(s){return normalize(s)}

/* ---- 日付 ---- */
function shiftDate(base,days){
  const d=new Date(base+"T00:00:00");
  d.setDate(d.getDate()+days);
  const p=n=>String(n).padStart(2,"0");
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`;
}
function parseDateLine(line,baseToday){
  const t=normalize(line).trim();
  if(/^今日$|^本日$/.test(t)) return baseToday;
  if(/^昨日$|^前日$/.test(t)) return shiftDate(baseToday,-1);
  if(/^一昨日$|^おととい$/.test(t)) return shiftDate(baseToday,-2);
  if(/^明日$/.test(t)) return shiftDate(baseToday,1);
  let m=t.match(/^(\d{4})[-\/年](\d{1,2})[-\/月](\d{1,2})日?$/);
  if(m) return `${m[1]}-${String(m[2]).padStart(2,"0")}-${String(m[3]).padStart(2,"0")}`;
  m=t.match(/^(\d{1,2})[-\/月](\d{1,2})日?$/);
  if(m) return `${baseToday.slice(0,4)}-${String(m[1]).padStart(2,"0")}-${String(m[2]).padStart(2,"0")}`;
  return null;
}

/* ---- 利用者名の照合（「峯俊さん」→「峯俊　陽子」） ---- */
function matchClient(line,names){
  const t=normalize(line).trim().replace(/[:：]$/,"");
  if(!t||t.length>14) return null;
  if(names.includes(t)) return t;
  const bare=t.replace(/(さん|様)$/,"").replace(/\s+/g,"");
  if(!bare) return null;
  const hit=names.find(n=>{
    const nb=normalize(n).replace(/\s+/g,"");
    return nb===bare||nb.startsWith(bare)||bare.startsWith(nb);
  });
  return hit||null;
}

/* ---- 種目名のゆらぎ補正（編集距離1まで） ---- */
function editDistance(a,b){
  const m=a.length,n=b.length;
  if(Math.abs(m-n)>1) return 9;
  const prev=new Array(n+1),cur=new Array(n+1);
  for(let j=0;j<=n;j++) prev[j]=j;
  for(let i=1;i<=m;i++){
    cur[0]=i;
    for(let j=1;j<=n;j++){
      cur[j]=Math.min(prev[j]+1,cur[j-1]+1,prev[j-1]+(a[i-1]===b[j-1]?0:1));
    }
    for(let j=0;j<=n;j++) prev[j]=cur[j];
  }
  return prev[n];
}
/* よくある書きぶれ。種目リストに無いときだけ適用する */
const VARIANTS=[[/ロウ/g,"ロー"],[/デット/g,"デッド"],[/トライセプト/g,"トライセプス"],[/ラッド/g,"ラット"]];
function correctExercise(name,master){
  const t=String(name||"").trim();
  if(!t||master.includes(t)) return {name:t,corrected:false};
  const hit=master.find(x=>editDistance(t,x)<=1);
  if(hit) return {name:hit,corrected:true,from:t};
  let v=t;
  VARIANTS.forEach(([re,to])=>{v=v.replace(re,to)});
  if(v!==t){
    if(master.includes(v)) return {name:v,corrected:true,from:t};
    const hit2=master.find(x=>editDistance(v,x)<=1);
    if(hit2) return {name:hit2,corrected:true,from:t};
    return {name:v,corrected:true,from:t};
  }
  return {name:t,corrected:false};
}

/* ---- 1行を種目に変換 ---- */
function parseExerciseLine(rawLine,master){
  const line=normalize(rawLine).replace(/^[・\-*•\s]+/,"").trim();
  if(!line) return null;

  const weights=[...line.matchAll(/(\d+(?:\.\d+)?)\s*(?:キロ|kg|KG|Kg)/g)].map(m=>Number(m[1]));
  const bodyweight=/自重|体重|じじゅう/.test(line);
  const repsM=line.match(/(\d+)\s*回/);
  const setsM=line.match(/(\d+)\s*(?:セット|sets?)/i);
  const xM=line.match(/[×x]\s*(\d+)/i);

  /* 種目名 = 最初の数値トークンより前 */
  let head=line;
  const firstNum=line.search(/\d/);
  if(firstNum>0) head=line.slice(0,firstNum);
  head=head.replace(/[×x]\s*$/i,"").replace(/[、,・]\s*$/,"").trim();
  if(!head) return null;
  /* 「左右」「逆手持ち」などの補足は種目名に残す（別種目として扱うため） */

  let reps=repsM?Number(repsM[1]):null;
  let sets=setsM?Number(setsM[1]):null;
  const xVal=xM?Number(xM[1]):null;

  if(reps===null&&xVal!==null&&sets!==null) reps=xVal;          /* 35キロ×10 3セット */
  else if(reps!==null&&sets===null&&xVal!==null) sets=xVal;     /* 5キロ×3 10回 / 15回×3 */
  if(reps===null&&xVal!==null&&sets===null&&weights.length<=1){ reps=xVal; }

  /* 「サイドレイズ、リアレイズ」のように種目名側が並んでいる場合は分割 */
  const names=head.split(/[、,]/).map(x=>x.trim()).filter(Boolean);

  return names.map(n=>{
    const c=correctExercise(n,master);
    return {
      name:c.name, correctedFrom:c.corrected?c.from:"",
      weights:weights.slice(), bodyweight:bodyweight||!weights.length,
      reps, sets, raw:rawLine.trim()
    };
  });
}

/* pending な「各10回」行を前の種目へ適用する */
function applyPendingReps(pendingTargets,reps){
  pendingTargets.forEach(e=>{ if(e.reps===null) e.reps=reps; });
}

function buildSteps(e){
  const reps=e.reps===null?10:e.reps;
  if(e.weights.length>1) return e.weights.map(w=>({w,r:reps}));
  const w=e.weights.length?e.weights[0]:(e.bodyweight?"自重":0);
  const n=Math.max(1,e.sets||1);
  return Array.from({length:n},()=>({w,r:reps}));
}

/* ---- 全文を解析 ---- */
window.axisParseSessionText=function(text,opts){
  const o=opts||{};
  const baseToday=o.today||(typeof today==="function"?today():new Date().toISOString().slice(0,10));
  const names=o.clients||(typeof clientList==="function"?clientList().map(x=>x.name):[]);
  const master=o.master||(typeof axisExerciseRegistry==="function"?axisExerciseRegistry()
              :(typeof exerciseList==="function"?exerciseList():[]));

  const out=[], warnings=[];
  let date=baseToday, current=null, pending=[];

  String(text||"").split(/\r?\n/).forEach(rawLine=>{
    const line=normalize(rawLine).trim();
    if(!line) { return; }

    const d=parseDateLine(line,baseToday);
    if(d){ date=d; current=null; pending=[]; return; }

    /* 「各10回」だけの行 */
    const only=line.match(/^各?\s*(\d+)\s*回(?:\s*[×x]\s*(\d+)\s*(?:セット)?)?$/);
    if(only&&pending.length){
      applyPendingReps(pending,Number(only[1]));
      pending=[];
      return;
    }

    const c=matchClient(line,names);
    if(c){
      current={date,client:c,exercises:[]};
      out.push(current);
      pending=[];
      return;
    }
    if(!current){
      warnings.push(`利用者名の前に書かれているため読み飛ばしました: ${line}`);
      return;
    }

    const parsed=parseExerciseLine(rawLine,master);
    if(!parsed||!parsed.length){ warnings.push(`読み取れませんでした: ${line}`); return; }
    parsed.forEach(e=>current.exercises.push(e));
    /* 回数が書かれていない行は、後から来る「各10回」を待つ */
    pending=pending.concat(parsed.filter(e=>e.reps===null));
  });

  /* 最後まで回数が決まらなかったものは10回として扱う */
  out.forEach(s=>s.exercises.forEach(e=>{
    if(e.reps===null){ e.reps=10; warnings.push(`${s.client} ${e.name}：回数が読み取れないため10回としました`); }
  }));

  return {
    sessions:out.filter(s=>s.exercises.length).map(s=>({
      date:s.date, client:s.client,
      exercises:s.exercises.map(e=>{
        const steps=buildSteps(e);
        return {
          exercise:e.name, correctedFrom:e.correctedFrom, raw:e.raw,
          steps, weight:steps[0].w, reps:steps[0].r, sets:steps.length, done:steps.map((_,i)=>i)
        };
      })
    })),
    warnings
  };
};
})();

/* ===== 貼り付け取り込みの画面 ===== */
(function(){
"use strict";
let parsed=null;

const el=s=>document.querySelector(s);
const esc2=s=>typeof esc==="function"?esc(s):String(s??"");
function totalVolume(ex){
  return ex.reduce((sum,e)=>sum+e.steps.reduce((a,s)=>a+(typeof s.w==="number"?s.w*(Number(s.r)||0):0),0),0);
}
function heaviest(ex){
  let best=null;
  ex.forEach(e=>e.steps.forEach(s=>{if(typeof s.w==="number"&&(!best||s.w>best.w))best={name:e.exercise,w:s.w,r:s.r}}));
  return best;
}
function isPyramid(e){
  const ws=e.steps.map(s=>s.w).filter(w=>typeof w==="number");
  return new Set(ws).size>=3;
}

/* ---- メモの下書き ---- */
function draftMemos(s){
  const ex=s.exercises, vol=Math.round(totalVolume(ex)), top=heaviest(ex);
  const py=ex.filter(isPyramid).map(e=>e.exercise);
  const sets=ex.reduce((a,e)=>a+e.steps.length,0);
  const names=ex.map(e=>e.exercise);
  const has=re=>names.some(n=>re.test(n));

  const prev=typeof latest==="function"?latest(s.client,s.date):null;
  let trend="";
  if(prev&&typeof clientVolumeOf==="function"){} /* 既存指標があれば使う */

  const insight=[
    `${ex.length}種目・計${sets}セットを実施。総負荷はおよそ${vol.toLocaleString()}kg。`,
    top?`最も高重量は${top.name}の${top.w}kg×${top.r}回。`:"",
    py.length?`${py.join("・")}は重量を段階的に変える組み方で、高重量からフォームを保ったまま追い込めていた。`:""
  ].filter(Boolean).join("");

  const cautions=[];
  if(has(/スクワット|レッグプレス|ランジ|ブルガリアン/)) cautions.push("スクワット系はしゃがむ深さと膝の向きを優先し、重量が上がった日は腰の反りすぎに注意する");
  if(has(/デッドリフト|ヒップスラスト|バックエクステンション|ヒップヒンジ/)) cautions.push("股関節から曲げる動きは、腰で引かずお尻とももの裏で支える");
  if(has(/ベンチプレス|チェスト|プレス|フライ/)) cautions.push("プレス系は肩がすくまないよう肩甲骨を寄せた位置を保つ");
  if(has(/ロー|プルダウン|懸垂/)) cautions.push("引く種目は腕だけで引かず、背中で引く意識を保つ");
  if(has(/レイズ/)) cautions.push("レイズ系は反動を使わず、軽い重量でも止める位置をそろえる");
  const caution=cautions.slice(0,3).map(x=>"・"+x).join("\n");

  const share=[
    top?`本日は${top.name}で${top.w}kgまで扱えました。`:"本日もお疲れさまでした。",
    py.length?"重量を段階的に上げ下げする組み方で、最後まで動きの質を保てていました。":"設定したメニューを最後までやり切れています。",
    "トレーニング後30分以内にたんぱく質を20g程度とると、回復が進みやすくなります。"
  ].join("");

  const next=[];
  if(top) next.push(`${top.name}は同じ重量で回数を安定させてから、次の段階へ上げる`);
  if(py.length) next.push(`${py[0]}は最も重い重量の回数を1回でも増やすことを目標にする`);
  if(has(/アブクラッシャー|腹|プランク/)) next.push("腹部種目は反動を減らし、戻す動作をゆっくりにする");
  if(!next.length) next.push("同じ重量で回数を1回増やすことを目標にする");

  return {insight, caution, share, next:next.slice(0,3).map(x=>"・"+x).join("\n")};
}

/* ---- 画面 ---- */
window.axisOpenBulkImport=function(){
  let box=el("#axisBulkImport");
  if(!box){
    box=document.createElement("div");
    box.id="axisBulkImport";
    box.className="ax20-overlay";
    document.body.appendChild(box);
  }
  box.innerHTML=`
    <div class="ax20-sheet">
      <div class="ax20-head">
        <div><span class="ax16-eyebrow">BULK INPUT</span><h2>まとめて入力</h2></div>
        <button type="button" class="ax20-close" onclick="axisCloseBulkImport()">閉じる</button>
      </div>
      <p class="ax20-help">メモをそのまま貼り付けてください。日付（今日・昨日・9/24 など）、利用者名、種目の順に読み取ります。取り込む前に内容を確認できます。</p>
      <textarea id="ax20-text" placeholder="昨日&#10;峯俊さん&#10;スクワット 35キロ×10 3セット&#10;&#10;今日&#10;市川さん&#10;ベンチプレス 50キロ、60キロ、55キロ 各10回"></textarea>
      <div class="ax20-actions">
        <button type="button" class="ax20-btn pri" onclick="axisPreviewBulkImport()">内容を確認する</button>
      </div>
      <div id="ax20-preview"></div>
    </div>`;
  box.classList.add("on");
};
window.axisCloseBulkImport=function(){
  const box=el("#axisBulkImport");
  if(box) box.classList.remove("on");
};

window.axisPreviewBulkImport=function(){
  const text=el("#ax20-text")?.value||"";
  const r=window.axisParseSessionText(text);
  parsed=r.sessions.map(s=>({...s,memos:draftMemos(s)}));
  const pv=el("#ax20-preview");
  if(!parsed.length){
    pv.innerHTML=`<div class="ax20-warn">読み取れるセッションがありませんでした。利用者名の行と、その下に種目の行があるか確認してください。</div>`;
    return;
  }
  pv.innerHTML=
    (r.warnings.length?`<div class="ax20-warn">${r.warnings.map(w=>esc2(w)).join("<br>")}</div>`:"")
    +parsed.map((s,i)=>`
      <section class="ax20-card">
        <div class="ax20-cardhead"><b>${esc2(s.client)}</b><span>${esc2(s.date)}</span></div>
        <ul class="ax20-list">
          ${s.exercises.map(e=>`<li>
            <b>${esc2(e.exercise)}</b>
            ${e.correctedFrom?`<i>「${esc2(e.correctedFrom)}」から修正</i>`:""}
            <span class="ax20-detail">${e.steps.map(x=>typeof x.w==="number"?x.w+"kg":"自重").join(" / ")}</span>
            <span class="ax20-count">${esc2(e.steps[0].r)}回 × ${e.steps.length}セット</span>
          </li>`).join("")}
        </ul>
        <label>気づき<textarea data-i="${i}" data-k="insight">${esc2(s.memos.insight)}</textarea></label>
        <label>注意点<textarea data-i="${i}" data-k="caution">${esc2(s.memos.caution)}</textarea></label>
        <label>共有事項<textarea data-i="${i}" data-k="share">${esc2(s.memos.share)}</textarea></label>
        <label>次回やること<textarea data-i="${i}" data-k="next">${esc2(s.memos.next)}</textarea></label>
      </section>`).join("")
    +`<div class="ax20-actions">
        <button type="button" class="ax20-btn pri" onclick="axisCommitBulkImport()">この内容で ${parsed.length}件を取り込む</button>
      </div>`;
  pv.querySelectorAll("textarea[data-k]").forEach(t=>{
    t.addEventListener("input",()=>{ parsed[Number(t.dataset.i)].memos[t.dataset.k]=t.value });
  });
};

function toSession(s){
  return {
    date:s.date, client:s.client, status:"完了", rpe:"", pain:0,
    note:s.memos.insight, insight:s.memos.insight, caution:s.memos.caution,
    share:s.memos.share, next:s.memos.next,
    exercises:s.exercises.map(e=>({
      exercise:e.exercise,
      steps:e.steps.map(x=>({w:x.w,r:x.r})),
      weight:e.steps[0].w, reps:e.steps[0].r, sets:e.steps.length,
      done:e.steps.map((_,i)=>i)
    })),
    savedAt:new Date().toISOString()
  };
}
window.axisBulkImportPayload=function(){ return {sessions:(parsed||[]).map(toSession),exported:new Date().toISOString()} };

window.axisCommitBulkImport=function(){
  if(!parsed||!parsed.length) return;
  if(!confirm(`${parsed.length}件のセッションを取り込みます。既存の記録は消えません。よろしいですか？`)) return;
  const payload=window.axisBulkImportPayload();
  if(typeof axisImportBackupData==="function") axisImportBackupData(payload);
  else{
    const cur=JSON.parse(localStorage.getItem("axis_training_added")||"[]");
    localStorage.setItem("axis_training_added",JSON.stringify([...payload.sessions,...cur]));
    if(typeof renderAll==="function") renderAll();
  }
  payload.sessions.forEach(s=>s.exercises.forEach(e=>{
    if(typeof axisRegisterExercise==="function") axisRegisterExercise(e.exercise);
  }));
  alert(`${payload.sessions.length}件を取り込みました。`);
  window.axisCloseBulkImport();
};

/* 「その他」に入口を出す */
function injectEntry(){
  if(document.querySelector("#axisBulkEntry")) return;
  const anchor=[...document.querySelectorAll("button")].find(b=>/全履歴Excel|全履歴をExcel/.test(b.textContent));
  if(!anchor) return;
  const b=document.createElement("button");
  b.id="axisBulkEntry";
  b.className=anchor.className.includes("ax16")?"ax16-btn soft":"btn soft";
  b.style.cssText="width:100%;margin-top:8px";
  b.textContent="まとめて入力（メモを貼り付けて取り込む）";
  b.onclick=()=>window.axisOpenBulkImport();
  anchor.parentElement.appendChild(b);
}
document.addEventListener("click",()=>setTimeout(injectEntry,60));
setTimeout(injectEntry,900);
window.axisInjectBulkEntry=injectEntry;
})();
