(function(){
window.musclesForExercise=function(name){
  const n=String(name||"").toLowerCase(),m=new Set(),add=(...xs)=>xs.forEach(x=>m.add(x));
  if(/ベンチ|チェスト|胸|push.?up|プッシュアップ|ダンベルプレス/.test(n))add("胸","肩","三頭");
  if(/ラット|ロー|背中|row|pull.?down|プルダウン|懸垂/.test(n))add("広背筋","二頭");
  if(/スクワット|レッグプレス|ブルガリアン|ランジ|lunge/.test(n))add("大腿四頭筋","臀筋","ハム");
  if(/デッド|rdl|ルーマニアン|ヒップヒンジ|ヒップスラスト/.test(n))add("臀筋","ハム","脊柱起立筋");
  if(/レッグエクステンション/.test(n))add("大腿四頭筋"); if(/レッグカール/.test(n))add("ハム");
  if(/ショルダー|サイドレイズ|ラテラル|shoulder|raise/.test(n))add("肩");
  if(/カール|curl/.test(n))add("二頭"); if(/トライセプ|三頭/.test(n))add("三頭");
  if(/クランチ|腹|abs|プランク|plank/.test(n))add("腹筋"); if(/バックエクステンション/.test(n))add("脊柱起立筋","臀筋");
  if(/カーフ|calf/.test(n))add("ふくらはぎ"); if(/ジャンプ|ホップ|jump|hop/.test(n))add("大腿四頭筋","臀筋","ふくらはぎ");
  if(!m.size)add("全身"); return [...m]
};
window.muscleMap=function(rows){
  const on=new Set((rows||[]).flatMap(r=>musclesForExercise(r.exercise||r))),cl=x=>on.has(x)||on.has("全身")?"muscle-on":"muscle-off";
  return `<div class="muscle-wrap"><svg class="muscle-svg" viewBox="0 0 180 260">
  <g transform="translate(8,5)"><circle class="muscle-off" cx="48" cy="20" r="15"/><path class="muscle-off" d="M36 38Q48 32 60 38L68 94Q60 110 48 111Q36 110 28 94Z"/>
  <ellipse class="${cl("肩")}" cx="28" cy="49" rx="11" ry="15"/><ellipse class="${cl("肩")}" cx="68" cy="49" rx="11" ry="15"/><ellipse class="${cl("胸")}" cx="40" cy="58" rx="11" ry="13"/><ellipse class="${cl("胸")}" cx="56" cy="58" rx="11" ry="13"/><rect class="${cl("腹筋")}" x="39" y="73" width="18" height="31" rx="8"/><ellipse class="${cl("二頭")}" cx="21" cy="78" rx="7" ry="18"/><ellipse class="${cl("三頭")}" cx="75" cy="78" rx="7" ry="18"/><ellipse class="${cl("大腿四頭筋")}" cx="38" cy="139" rx="10" ry="30"/><ellipse class="${cl("大腿四頭筋")}" cx="59" cy="139" rx="10" ry="30"/><ellipse class="${cl("ふくらはぎ")}" cx="39" cy="205" rx="7" ry="27"/><ellipse class="${cl("ふくらはぎ")}" cx="58" cy="205" rx="7" ry="27"/></g>
  <g transform="translate(88,5)"><circle class="muscle-off" cx="48" cy="20" r="15"/><path class="muscle-off" d="M36 38Q48 32 60 38L68 94Q60 110 48 111Q36 110 28 94Z"/><path class="${cl("広背筋")}" d="M34 45Q48 40 62 45L65 84Q56 98 48 100Q40 98 31 84Z"/><rect class="${cl("脊柱起立筋")}" x="43" y="53" width="10" height="51" rx="5"/><ellipse class="${cl("臀筋")}" cx="39" cy="113" rx="13" ry="13"/><ellipse class="${cl("臀筋")}" cx="57" cy="113" rx="13" ry="13"/><ellipse class="${cl("ハム")}" cx="38" cy="151" rx="9" ry="29"/><ellipse class="${cl("ハム")}" cx="59" cy="151" rx="9" ry="29"/></g></svg>
  <div class="muscle-labels">${[...on].slice(0,5).map(x=>`<span class="muscle-chip">${esc(x)}</span>`).join("")}</div></div>`
};
if(!document.querySelector("#summary")){const x=document.createElement("section");x.id="summary";x.className="view";document.querySelector(".main").appendChild(x)}
window.openSummary=function(c){
  const last=sessions(c)[0],a=analyzeClient(c),rows=last?.rows||[],adv=(typeof professionalAdvice==="function"?professionalAdvice(c):a.advice)||[];
  show("summary",false);$("#summary").innerHTML=`<div class="summary-shell"><div class="summary-brand">AXIS TRAINING / SESSION REPORT</div>
  <div class="summary-name">${esc(displayClientName(c))}</div><div class="sub">${last?jp(last.date):jp(today())}</div><div class="summary-grid"><div>
  <div class="summary-block"><b>TODAY'S MENU</b>${rows.slice(0,7).map(r=>`<div style="margin-top:7px">${esc(r.exercise)}　${esc(r.weight)}${typeof r.weight==="number"?"kg":""} × ${esc(r.reps)}回 × ${esc(r.sets)}set</div>`).join("")}</div>
  <div class="summary-block"><b>PROGRESS</b><div style="margin-top:7px">${esc(a.progress?.[0]||"フォームの安定を確認しながら継続できています。")}</div></div></div>${muscleMap(rows)}</div>
  <div class="summary-block"><b>COACH'S ADVICE</b><div style="margin-top:7px">${esc(adv[0]||"無理のない範囲で継続していきましょう。")}</div></div>
  <div class="summary-block"><b>NEXT</b><div style="margin-top:7px">${esc(a.next?.[0]?.text||"状態を見ながら負荷調整")}</div><div class="sub" style="margin-top:7px">次回：${esc(typeof nextTrainingText==="function"?nextTrainingText(c):"未登録")}</div></div>
  <div class="summary-brand" style="text-align:center;margin-top:18px">AXIS PERSONAL TRAINING</div></div>
  <div style="max-width:560px;margin:10px auto;display:grid;grid-template-columns:1fr 1fr;gap:8px"><button class="btn soft" onclick="openClient('${String(c).replace(/'/g,"\\'")}')">戻る</button><button class="btn primary" onclick="alert('この画面をスクリーンショットしてください')">スクショ用</button></div>`
};
const oldAnalysis=window.analysisHTML;
window.analysisHTML=function(c){
 const a=analyzeClient(c),last=a.recent?.[0],vals=(a.recent||[]).map(s=>({d:s.date,v:Math.round(sessionVolume(s))})).filter(x=>x.v>0).reverse(),mx=Math.max(...vals.map(x=>x.v),1);
 return `<div class="title"><h3>PERFORMANCE</h3></div><div class="nextdate"><b>次回トレーニング</b><br>${esc(typeof nextTrainingText==="function"?nextTrainingText(c):"未登録")}</div>
 <div class="ax-viz"><div class="analysis-card"><b>TRAINING LOAD</b><div class="ax-bars">${vals.map(x=>`<div class="ax-barcol"><div class="ax-bar" style="height:${Math.max(6,Math.round(x.v/mx*100))}%"></div><div class="ax-barlabel">${fmt(x.d)}</div></div>`).join("")}</div>
 ${(a.progress||[]).slice(0,3).map(x=>`<div style="padding:7px 0;border-top:1px solid #152033">${esc(x)}</div>`).join("")||'<div class="sub">直近は維持。フォームの質を優先。</div>'}</div>${muscleMap(last?.rows||[])}</div>
 <div class="analysis-grid" style="margin-top:10px"><div class="analysis-card"><b>NEXT SESSION</b><ul>${(a.next||[]).slice(0,5).map(x=>`<li>${esc(x.exercise)}：${esc(x.text)}</li>`).join("")}</ul><button class="btn primary" style="width:100%" onclick="useSuggestedMenu('${String(c).replace(/'/g,"\\'")}')">このメニューで開始</button></div>
 <div class="analysis-card"><b>COACHING</b><ul>${(typeof professionalAdvice==="function"?professionalAdvice(c):a.advice).slice(0,2).map(x=>`<li>${esc(x)}</li>`).join("")}</ul><button class="btn soft" style="width:100%" onclick="openSummary('${String(c).replace(/'/g,"\\'")}')">お客様向けまとめ</button></div></div>
 <details class="ax-collapsible" style="margin-top:10px"><summary>LINE文面</summary><textarea id="lineText" class="linebox">${esc(typeof professionalLine==="function"?professionalLine(c,a):a.line)}</textarea><button id="copyLineBtn" class="btn primary" style="width:100%" onclick="copyLine()">コピー</button></details>`
};
})();
(function(){
const _renderHome=window.renderHome;
window.renderHome=function(){
  const t=today(),sch=mergedSchedule(),todayItems=sch.filter(x=>x.date===t),up=sch.filter(x=>x.date>t).slice(0,3),cs=clientList();
  $("#home").innerHTML=`<div class="hero"><div>TODAY · ${t}</div><h2>${todayItems.length?todayItems.length+" SESSIONS":"READY"}</h2><div>40分に集中。記録・分析・次回提案まで、ここで完結。</div></div>
  <div class="ax-actions"><button class="btn primary" onclick="show('input');renderInput(draft||{})">＋ トレーニング記録</button><button class="btn soft" onclick="show('clients')">利用者を開く</button></div>
  <div class="title"><h3>今日の予定</h3></div><div class="ax-today">${todayItems.length?todayItems.map(card).join(""):'<div class="card empty">今日の予定はありません</div>'}</div>
  ${!todayItems.length&&up.length?`<div class="title"><h3>NEXT</h3></div>${up.map(card).join("")}`:""}
  <div class="kpis" style="margin-top:12px"><div class="kpi"><b>${cs.length}</b><span>CLIENTS</span></div><div class="kpi"><b>${added.length}</b><span>APP SESSIONS</span></div><div class="kpi"><b>${all().length}</b><span>RECORDS</span></div></div>
  <details class="ax-collapsible ax-section"><summary>Excel・バックアップ</summary><div class="exportgrid" style="margin-top:10px"><button class="btn primary" onclick="exportExcel('new')">Excel取込用</button><button class="btn soft" onclick="exportExcel('all')">全履歴Excel</button><button class="btn soft" onclick="exportBackup()">JSONバックアップ</button></div></details>
  ${META.calendarSyncedAt?`<div class="sub" style="margin:10px 4px">Googleカレンダー同期：${esc(META.calendarSyncedAt)}</div>`:""}`;
};
})();
