(function(){
window.jp=function(d){if(!d)return'';const x=new Date(String(d).slice(0,10)+'T00:00:00+09:00');if(Number.isNaN(x.getTime()))return String(d);const wd=['日','月','火','水','木','金','土'][x.getDay()];return `${x.getFullYear()}年${x.getMonth()+1}月${x.getDate()}日 (${wd})`};
function ensureView(id){if(!document.querySelector("#"+id)){const s=document.createElement("section");s.id=id;s.className="view";document.querySelector(".main").appendChild(s)}}
ensureView("analytics");ensureView("more");

window.axisLogo=()=>'<div class="ax-logo">A<span class="x">X</span>IS<small>TRAINING</small></div>';
window.axisMonthStats=function(){
 const t=today(),m=t.slice(0,7),ss=sessions().filter(x=>x.date?.startsWith(m)&&x.date<=t);
 const vol=ss.reduce((a,s)=>a+sessionVolume(s),0);
 const done=added.filter(x=>x.date?.startsWith(m)),ok=done.filter(x=>!["要確認","変更"].includes(x.status)).length;
 return {sessions:ss.length,vol:Math.round(vol),rate:done.length?Math.round(ok/done.length*100):100}
};
window.axisWeekSessions=function(){
 const allS=sessions().filter(x=>x.date<=today()),latest=[...new Set(allS.map(x=>x.date))].sort().slice(-7),map=new Map(latest.map(d=>[d,0]));
 allS.forEach(s=>{if(map.has(s.date))map.set(s.date,map.get(s.date)+sessionVolume(s))});
 return [...map.entries()].map(([d,v])=>({d,v:Math.round(v)}))
};
window.axisScheduleCard=function(s){
 const l=s.type==="パーソナル"?latest(s.client,s.date):null;
 return `<div class="ax-schedule" ${s.type==="パーソナル"&&clientList().some(x=>x.name===s.client)?`onclick="openClient('${String(s.client).replace(/'/g,"\\'")}')"`:""}>
 <div class="ax-schedule-time"><strong>${esc(s.time)}</strong><span>${s.type==="パーソナル"?"PT":esc(s.type||"予定")}</span></div>
 <div class="ax-schedule-main"><b>${esc(s.label||s.client)}</b><div class="subline">${META.goals?.[s.client]?esc(META.goals[s.client]):s.calendar?"Google Calendar":"AXIS TRAINING"}</div>
 <div class="ax-tags">${l?`<span class="ax-tag">${l.rows.length}種目</span>`:""}${s.type==="パーソナル"?'<span class="ax-tag">40分</span>':""}${s.calendar?'<span class="ax-tag">Calendar</span>':""}</div></div><div class="ax-chevron">›</div></div>`
};
window.axisBarChart=function(items){
 if(!items.length)return '<div class="ax-muted">データなし</div>';const mx=Math.max(...items.map(x=>x.v),1);
 return `<div class="ax-chart">${items.map(x=>`<div class="ax-chart-col"><div class="ax-chart-bar" style="height:${Math.max(6,Math.round(x.v/mx*100))}%"></div><div class="ax-chart-label">${fmt(x.d).slice(0,5)}</div></div>`).join("")}</div>`
};
window.renderHome=function(){
 const t=today(),sch=mergedSchedule(),todayItems=sch.filter(x=>x.date===t),up=sch.filter(x=>x.date>t).slice(0,2),st=axisMonthStats(),week=axisWeekSessions(),last=sessions().find(x=>x.date<=t),focus=(todayItems.find(x=>x.type==="パーソナル"&&clientList().some(c=>c.name===x.client))||up.find(x=>x.type==="パーソナル"&&clientList().some(c=>c.name===x.client))),a=focus?analyzeClient(focus.client):null;
 $("#home").innerHTML=`<div class="ax-home-head"><div class="ax-home-top">${axisLogo()}<div class="ax-eyebrow">TRAIN PEOPLE<br>CHANGE LIVES</div></div>
 <div class="ax-date"><span class="ico">▣</span>${jp(t)}</div><div class="ax-message">継続が、<br>理想の自分をつくる。<span>今日の積み重ねが、未来を変える。</span></div></div>
 <div class="ax-grid3">
  <div class="ax-stat"><div class="icon">◫</div><label>今月のセッション</label><strong>${st.sessions}<small>回</small></strong><small>SESSION</small></div>
  <div class="ax-stat"><div class="icon">▥</div><label>今週の総ボリューム</label><strong>${week.reduce((a,x)=>a+x.v,0).toLocaleString()}<small>kg</small></strong><small>LOAD</small></div>
  <div class="ax-stat"><div class="icon">◉</div><label>継続率</label><strong>${st.rate}<small>%</small></strong><small>CONTINUE</small></div>
 </div>
 <div class="ax-panel"><div class="ax-panel-head"><div class="ax-panel-title"><span class="i">▣</span>今日の予定</div><span class="ax-link" onclick="show('schedule')">すべて見る ›</span></div>${todayItems.length?todayItems.map(axisScheduleCard).join(""):'<div class="ax-muted">今日の予定はありません</div>'}</div>
 <div class="ax-home-analytics"><div class="ax-panel"><div class="ax-panel-head"><div class="ax-panel-title"><span class="i">▰</span>データ分析</div><span class="ax-link" onclick="show('analytics');renderAnalytics()">›</span></div><div class="ax-eyebrow">TRAINING VOLUME</div><div style="font-size:25px;font-weight:900;margin-top:2px">${week.reduce((a,x)=>a+x.v,0).toLocaleString()}<small style="font-size:11px"> kg</small></div>${axisBarChart(week)}</div>
 <div class="ax-panel"><div class="ax-panel-head"><div class="ax-panel-title"><span class="i">♟</span>鍛えた部位</div></div>${muscleMap(last?.rows||[])}</div></div>
 <div class="ax-panel"><div class="ax-panel-head"><div class="ax-panel-title"><span class="i">◈</span>次回提案</div></div><b>${a?.next?.[0]?esc(a.next[0].exercise):"次のセッションを準備"}</b><div class="ax-muted" style="margin-top:6px">${a?.next?.[0]?esc(a.next[0].text):"利用者を開くと、過去記録から次回メニューを提案します。"}</div></div>
 <div class="ax-panel"><div class="ax-panel-head"><div class="ax-panel-title"><span class="i">＋</span>クイック入力</div></div><div class="ax-actions"><button class="btn soft" onclick="show('input');renderInput(draft||{})">重量・回数</button><button class="btn soft" onclick="show('input');renderInput(draft||{});setTimeout(()=>$('#finsight')?.focus(),100)">メモのみ</button></div><button class="btn primary" style="width:100%;padding:14px" onclick="show('input');renderInput(draft||{})">トレーニングを記録する ›</button></div>
 ${up.length&&!todayItems.length?'<div class="ax-panel"><div class="ax-panel-title">次の予定</div>'+up.map(axisScheduleCard).join("")+'</div>':""}`
};

window.renderAnalytics=function(){
 const week=axisWeekSessions(),clients=clientList();
 $("#analytics").innerHTML=`<div class="ax-home-head"><div class="ax-eyebrow">ANALYTICS</div><h2 style="margin:4px 0 6px">データ分析</h2><div class="ax-muted">全体の負荷と、各お客様の変化を見える化。</div></div>
 <div class="ax-panel"><div class="ax-panel-title">直近トレーニングボリューム</div>${axisBarChart(week)}</div>
 <div class="title"><h3>CLIENT ANALYTICS</h3></div><div class="grid">${clients.map(c=>`<button class="client" onclick="openClient('${String(c.name).replace(/'/g,"\\'")}')"><b>${esc(c.name)}</b><span>${c.days}日 / ${c.rows}種目　›</span></button>`).join("")}</div>`
};
window.renderMore=function(){
 $("#more").innerHTML=`<div class="ax-home-head"><div class="ax-eyebrow">TOOLS</div><h2 style="margin:4px 0">その他</h2></div>
 <div class="ax-panel"><div class="ax-actions"><button class="btn soft" onclick="show('history')">全履歴</button><button class="btn soft" onclick="show('input');renderInput(draft||{})">トレ中入力</button></div></div>
 <div class="ax-panel"><div class="ax-panel-title">Excel・バックアップ</div><div class="ax-actions"><button class="btn primary" onclick="exportExcel('new')">Excel取込用</button><button class="btn soft" onclick="exportExcel('all')">全履歴Excel</button></div><button class="btn soft" style="width:100%" onclick="exportBackup()">JSONバックアップ</button></div>`
};

function setupNav(){
 const b=$("#bottom");if(!b)return;b.innerHTML='<button class="nav on" data-v="home"><b>⌂</b>ホーム</button><button class="nav" data-v="clients"><b>♟</b>利用者</button><button class="nav" data-v="schedule"><b>▣</b>スケジュール</button><button class="nav" data-v="analytics"><b>▰</b>分析</button><button class="nav" data-v="more"><b>•••</b>その他</button>';
 b.querySelectorAll(".nav").forEach(x=>x.onclick=()=>{show(x.dataset.v);if(x.dataset.v==="analytics")renderAnalytics();if(x.dataset.v==="more")renderMore()})
}
window.axisSetupNav=setupNav;
})();
(function(){
window.analysisHTML=function(c){
 const a=analyzeClient(c),last=a.recent?.[0],vals=(a.recent||[]).map(s=>({d:s.date,v:Math.round(sessionVolume(s))})).filter(x=>x.v>0).reverse(),mx=Math.max(...vals.map(x=>x.v),1),adv=typeof professionalAdvice==="function"?professionalAdvice(c):a.advice;
 return `<div class="title"><h3>PERFORMANCE</h3></div><div class="nextdate"><b>次回トレーニング</b><br>${esc(typeof nextTrainingText==="function"?nextTrainingText(c):"未登録")}</div>
 <div class="ax-analysis-top"><div class="analysis-card"><div class="ax-eyebrow">TRAINING LOAD</div><div class="ax-bars">${vals.map(x=>`<div class="ax-barcol"><div class="ax-bar" style="height:${Math.max(6,Math.round(x.v/mx*100))}%"></div><div class="ax-barlabel">${fmt(x.d)}</div></div>`).join("")}</div>
 ${(a.progress||[]).slice(0,3).map(x=>`<div style="padding:7px 0;border-top:1px solid #112b45;font-size:12px">${esc(x)}</div>`).join("")||'<div class="ax-muted">直近は維持。フォームの質を優先。</div>'}</div>
 ${muscleMap(last?.rows||[])}</div>
 <div class="analysis-grid" style="margin-top:8px"><div class="analysis-card"><div class="ax-eyebrow">NEXT SESSION</div><ul>${(a.next||[]).slice(0,5).map(x=>`<li><b>${esc(x.exercise)}</b><br>${esc(x.text)}</li>`).join("")}</ul><button class="btn primary" style="width:100%" onclick="useSuggestedMenu('${String(c).replace(/'/g,"\\'")}')">このメニューで開始</button></div>
 <div class="analysis-card"><div class="ax-eyebrow">COACHING</div><ul>${(adv||[]).slice(0,2).map(x=>`<li>${esc(x)}</li>`).join("")}</ul><button class="btn soft" style="width:100%" onclick="openSummary('${String(c).replace(/'/g,"\\'")}')">お客様向けまとめ</button></div></div>
 <details class="ax-collapsible" style="margin-top:8px"><summary>LINE文面を表示</summary><textarea id="lineText" class="linebox" style="margin-top:9px">${esc(typeof professionalLine==="function"?professionalLine(c,a):a.line)}</textarea><button id="copyLineBtn" class="btn primary" style="width:100%;margin-top:8px" onclick="copyLine()">LINE文面をコピー</button></details>`
};

window.openClient=function(c){
 current=c;show("detail",false);const ss=sessions(c),last=ss[0];
 $("#detail").innerHTML=`<div class="ax-panel"><div class="ax-client-head"><div><div class="ax-eyebrow">CLIENT</div><h2>${esc(c)}</h2><div class="ax-muted">${META.goals?.[c]?esc(META.goals[c]):"目標未登録"}</div></div><button class="ax-round" onclick="show('clients')">‹</button></div>
 ${META.attention?.[c]?`<details class="ax-collapsible" style="margin-top:10px"><summary>注意・共有事項</summary><div class="ax-muted" style="padding-top:8px">${esc(META.attention[c])}</div></details>`:""}
 <div class="ax-client-buttons"><button class="btn primary" onclick="prefill('${String(c).replace(/'/g,"\\'")}')">直近メニューで開始</button><button class="btn soft" onclick="openSummary('${String(c).replace(/'/g,"\\'")}')">共有レポート</button></div>
 ${last?`<div class="ax-muted" style="margin-top:10px">直近：${fmt(last.date)}　${last.rows.length}種目</div>`:""}</div>
 ${analysisHTML(c)}
 <details class="ax-collapsible" style="margin-top:10px"><summary>過去メニューを見る</summary><div style="margin-top:9px">${ss.slice(0,20).map(histCard).join("")}</div></details>`
};

window.openSummary=function(c){
 const hist=sessions(c),last=hist[0],a=analyzeClient(c),rows=last?.rows||[],adv=(typeof professionalAdvice==="function"?professionalAdvice(c):a.advice)||[],vol=hist.slice(0,5).reverse().map(x=>({d:x.date,v:Math.round(sessionVolume(x))})),mx=Math.max(...vol.map(x=>x.v),1);
 show("summary",false);
 $("#summary").innerHTML=`<div class="summary-shell"><div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px">${axisLogo()}<div style="text-align:right"><div style="font-size:19px;font-weight:900">継続が、<br>理想の自分をつくる。</div><div class="summary-brand" style="margin-top:6px">TRAIN PEOPLE CHANGE LIVES</div></div></div>
 <div style="margin:18px 0 8px"><div class="summary-brand">SESSION REPORT</div></div>
 <div class="summary-block" style="display:grid;grid-template-columns:1fr auto;gap:10px;align-items:center"><div><div class="ax-eyebrow">CLIENT</div><div class="summary-name">${esc(displayClientName(c))}</div><div class="ax-muted">着実に前進しています。</div></div><div style="text-align:right"><div class="ax-eyebrow">DATE</div><b>${last?jp(last.date):jp(today())}</b><div style="color:#1bc7ff;font-size:28px">✓</div></div></div>
 <div class="summary-grid"><div class="summary-block"><div class="ax-panel-head"><b>今日のメニュー</b><span class="ax-muted">TOTAL ${rows.length}種目</span></div>${rows.slice(0,7).map((r,i)=>`<div style="display:grid;grid-template-columns:24px 1fr auto;gap:7px;align-items:center;border-top:1px solid #12304b;padding:8px 0"><span class="ax-setnum">${i+1}</span><b style="font-size:12px">${esc(r.exercise)}</b><span style="font-size:11px">${esc(r.weight)}${typeof r.weight==="number"?"kg":""}　${esc(r.reps)}回　${esc(r.sets)}set</span></div>`).join("")}</div>${muscleMap(rows)}</div>
 <div class="summary-outcome"><div class="summary-block"><div class="ax-eyebrow">SESSION RESULT</div><div style="font-size:12px;margin-top:6px">トレーニングボリューム</div><div style="font-size:26px;font-weight:900">${Math.round(sessionVolume(last||{rows:[]})).toLocaleString()}<small style="font-size:11px"> kg</small></div><div class="summary-bars">${vol.map(x=>`<div style="flex:1;display:flex;flex-direction:column;justify-content:flex-end"><div class="summary-bar" style="height:${Math.max(6,Math.round(x.v/mx*100))}%"></div><div class="summary-bar-label">${fmt(x.d).slice(0,5)}</div></div>`).join("")}</div></div>
 <div class="summary-block"><div class="ax-eyebrow">COACH'S ADVICE</div><div style="margin-top:10px;font-size:13px;line-height:1.75">${esc(adv[0]||"無理のない範囲で継続していきましょう。")}</div><div class="summary-brand" style="margin-top:18px">SMALL STEPS<br>MAKE BIG CHANGES.</div></div></div>
 <div class="summary-block"><div class="ax-panel-head"><b>次回のご提案</b><span>›</span></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:12px"><div><div class="ax-muted">次回トレーニング日</div><b>${esc(typeof nextTrainingText==="function"?nextTrainingText(c):"未登録")}</b></div><div><div class="ax-muted">おすすめメニュー</div><b>${esc(a.next?.[0]?.exercise||"状態を見ながら調整")}</b><div class="ax-muted">${esc(a.next?.[0]?.text||"")}</div></div></div></div>
 <div class="summary-brand" style="text-align:center;margin-top:18px">今日の積み重ねが、未来を変える。</div></div>
 <div class="ax-actions" style="max-width:560px;margin:10px auto"><button class="btn soft" onclick="openClient('${String(c).replace(/'/g,"\\'")}')">戻る</button><button class="btn primary" onclick="alert('この画面をそのままスクリーンショットしてください')">スクショ用</button></div>`
};
})();
(function(){
window.activeExerciseIndex=0;
window.renderInput=function(p={}){
 const cs=clientList().map(x=>x.name),ex=p.exercises||[{exercise:"",weight:0,weightStep:1,reps:10,sets:3,done:[]}];window.exs=ex.map(x=>({...x,weight:normalizeWeight(x.weight),weightStep:x.weightStep||inferWeightStep(x.weight),done:Array.isArray(x.done)?x.done:[]}));activeExerciseIndex=Math.min(activeExerciseIndex,Math.max(0,exs.length-1));
 const insight=p.insight??p.note??"",caution=p.caution??(p.client?META.attention?.[p.client]||"":"");
 $("#input").innerHTML=`<div class="ax-session-head"><div class="ax-session-client"><label>CLIENT</label><select id="fclient"><option value="">利用者を選択</option>${cs.map(x=>`<option ${p.client===x?"selected":""}>${esc(x)}</option>`).join("")}</select><div class="ax-muted">パーソナルトレーニング</div></div>
 <div class="ax-session-meta"><div class="ax-eyebrow">SESSION</div><div id="session40"><button class="btn primary" style="width:100%;margin-top:8px" onclick="startSession40()">40分開始</button></div></div></div>
 <div style="display:none"><input id="fdate" type="date" value="${p.date||today()}"><select id="fstatus"><option>完了</option><option>良好</option><option>要確認</option><option>変更</option></select></div>
 <div class="timerbar"><span id="timerText">休憩タイマー</span><span><button onclick="startTimer(60)">60秒</button><button onclick="startTimer(90)">90秒</button></span></div>
 <div id="editors"></div><div id="smartRest" class="smart-rest"><div class="ax-muted">セット完了後に、種目・回数・RPE・前回重量から休憩を提案します。</div></div>
 <div class="ax-memo"><div class="ax-memo-head"><div class="ax-panel-title">クイックメモ</div><button class="btn soft" onclick="autoFillSessionNotes()">自動作成</button></div>
 <div class="ax-memo-grid"><button class="ax-memo-btn" onclick="appendField('finsight','フォーム良好')">💡 気づき</button><button class="ax-memo-btn" onclick="appendField('fcaution','フォーム優先')">⚠ 注意点</button><button class="ax-memo-btn" onclick="appendField('fshare','体調問題なし')">♟ 共有事項</button></div>
 <textarea id="finsight" placeholder="気づき・フォーム・反応など">${esc(insight)}</textarea>
 <details class="ax-collapsible" style="margin-top:8px"><summary>注意点・共有事項・次回</summary><textarea id="fcaution" placeholder="注意点" style="margin-top:8px">${esc(caution)}</textarea><textarea id="fshare" placeholder="共有事項" style="margin-top:7px">${esc(p.share||"")}</textarea><textarea id="fnext" placeholder="次回やること" style="margin-top:7px">${esc(p.next||"")}</textarea><label class="ax-muted">痛み 0〜10</label><select id="fpain">${[0,1,2,3,4,5,6,7,8,9,10].map(x=>`<option ${String(p.pain)===String(x)?"selected":""}>${x}</option>`).join("")}</select></details>
 <button class="btn primary" style="width:100%;padding:14px;margin-top:10px" onclick="save()">セッションを終了・保存</button></div>`;
 drawEx();["fdate","fclient","fstatus","fpain","finsight","fcaution","fshare","fnext"].forEach(id=>$("#"+id)?.addEventListener("input",saveDraft));$("#fclient")?.addEventListener("change",()=>{const x=currentDraft();x.client=$("#fclient").value;if(!x.caution)x.caution=META.attention?.[x.client]||"";renderInput(x);saveDraft()})
};
window.drawEx=function(){
 const i=Math.min(activeExerciseIndex,Math.max(0,exs.length-1)),e=exs[i]||{exercise:"",weight:0,reps:10,sets:3,done:[]},client=$("#fclient")?.value||"",date=$("#fdate")?.value||today(),prev=client?latest(client,date):null,pr=prev?.rows?.find(x=>x.exercise===e.exercise),isBody=String(e.weight)==="自重",rpe=Number($("#frpe")?.value||7);
 $("#editors").innerHTML=`<div class="ax-current"><div class="ax-ex-head"><div class="ax-panel-title"><span class="i">▰</span>現在の種目</div><div><b>${i+1} / ${exs.length}</b></div><div class="ax-ex-nav"><button class="ax-round" onclick="axisPrevExercise()">‹</button><button class="ax-round" onclick="axisNextExercise()">›</button></div></div>
 <div class="ax-current-grid"><div><select class="exercise-select" onchange="chooseExercise(${i},this.value)">${exerciseOptions(e.exercise)}</select><div class="ax-tags" style="margin-top:8px">${musclesForExercise(e.exercise).slice(0,3).map(x=>`<span class="ax-tag">${esc(x)}</span>`).join("")}</div></div>${muscleMap([{exercise:e.exercise}])}</div>
 <div class="ax-control-grid">
 <div class="ax-control"><label>重量 (kg)</label><div class="value">${isBody?"自重":Number(e.weight||0).toFixed(1)}</div>${isBody?'<button class="btn soft" style="width:auto;margin-top:7px" onclick="setWeightStep('+i+',1)">重量へ</button>':`<div class="mini"><button onclick="axisAdjustWeight(${i},-1)">−</button><button onclick="axisAdjustWeight(${i},1)">＋</button></div><div class="ax-weight-quick"><button onclick="axisAdjustWeight(${i},-.5)">-0.5</button><button onclick="axisAdjustWeight(${i},.5)">+0.5</button></div>`}</div>
 <div class="ax-control"><label>回数</label><div class="value">${e.reps}</div><div class="mini"><button onclick="stepR(${i},-1)">−</button><button onclick="stepR(${i},1)">＋</button></div></div>
 <div class="ax-control"><label>セット</label><div class="value">${e.sets}</div><div class="mini"><button onclick="changeSets(${i},-1)">−</button><button onclick="changeSets(${i},1)">＋</button></div></div>
 <div class="ax-control"><label>RPE</label><div class="value" id="rpeVal">${rpe}</div><div class="mini"><button onclick="axisStepRPE(-1)">−</button><button onclick="axisStepRPE(1)">＋</button></div></div>
 </div>
 ${pr?`<div class="ax-prev"><div><div class="ax-eyebrow">前回の結果 · ${fmt(prev.date)}</div><strong>${esc(pr.weight)}${typeof pr.weight==="number"?"kg":""} × ${esc(pr.reps)}回 × ${esc(pr.sets)}set</strong></div><span class="ax-chevron">›</span></div>`:""}
 <div class="ax-set-main"><div><button class="btn primary ax-primary-action" onclick="completeNextSet(${i})">✓ このセットを記録する</button><button class="btn soft" style="width:100%;margin-top:7px" onclick="axisClearSets(${i})">↻ セットをクリア</button></div>
 <div class="ax-setlist"><div class="ax-eyebrow" style="margin-bottom:4px">SET STATUS　${e.done.length}/${e.sets}</div>${Array.from({length:Number(e.sets||3)},(_,j)=>`<div class="ax-setrow ${e.done.includes(j)?"done":""}" onclick="toggleSet(${i},${j})"><span class="ax-setnum">${j+1}</span><span>${e.done.includes(j)?esc(e.weight)+(typeof e.weight==="number"?"kg":"")+" × "+esc(e.reps):"未記録"}</span><span>${e.done.includes(j)?"✓":"•••"}</span></div>`).join("")}</div></div>
 <button class="btn soft" style="width:100%;margin-top:9px" onclick="addEx();activeExerciseIndex=exs.length-1;drawEx()">＋ 種目を追加</button></div>`
};
window.axisAdjustWeight=function(i,delta){const e=exs[i];if(String(e.weight)==="自重")e.weight=0;e.weight=Math.max(0,Math.round((Number(e.weight||0)+delta)*2)/2);drawEx();saveDraft()};
window.axisStepRPE=function(d){let el=$("#frpe");if(!el){el=document.createElement("input");el.id="frpe";el.type="hidden";$("#input").appendChild(el)}el.value=Math.max(1,Math.min(10,Number(el.value||7)+d));drawEx();saveDraft()};
window.axisPrevExercise=function(){activeExerciseIndex=(activeExerciseIndex-1+exs.length)%exs.length;drawEx()};
window.axisNextExercise=function(){activeExerciseIndex=(activeExerciseIndex+1)%exs.length;drawEx()};
window.completeNextSet=function(i){const e=exs[i],j=Array.from({length:Number(e.sets||3)},(_,k)=>k).find(k=>!e.done.includes(k));if(j===undefined){alert("この種目は全セット記録済みです");return}toggleSet(i,j)};
window.axisClearSets=function(i){exs[i].done=[];drawEx();saveDraft()};
window.showSmartRest=function(i){const e=exs[i],client=$("#fclient")?.value||"",rpe=$("#frpe")?.value||7,sec=smartRestSeconds(e,client,rpe),box=$("#smartRest");if(!box)return;box.innerHTML=`<div class="ax-rest-grid"><div class="ax-rest-ring"><div><span>推奨休憩</span><strong>${Math.floor(sec/60)}:${String(sec%60).padStart(2,"0")}</strong></div></div><div class="ax-rest-copy"><div class="ax-panel-title">スマート休憩</div><b>${isCompoundExercise(e.exercise)?"多関節種目":"補助種目"}に合わせた休憩</b><br>次のセットでパフォーマンスを保ちやすい時間です。<button class="btn primary" style="width:100%;margin-top:9px" onclick="startTimer(${sec})">▶ 休憩スタート</button></div></div>`};
})();
axisSetupNav();
window.renderAll=function(){
  const jobs=[
    ["home",()=>renderHome()],
    ["schedule",()=>renderSchedule()],
    ["clients",()=>renderClients()],
    ["history",()=>renderHistory()]
  ];
  for(const [id,fn] of jobs){
    try{fn()}catch(e){console.error("AXIS render error",id,e);const el=document.querySelector("#"+id);if(el&&!el.innerHTML.trim())el.innerHTML='<div class="ax-panel"><div class="ax-panel-title">読み込みを再試行してください</div><div class="ax-muted">画面の再読み込みで復旧します。</div></div>'}
  }
};
