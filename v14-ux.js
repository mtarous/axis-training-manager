
(function(){
window.muscleMap=function(rows){
 const on=new Set((rows||[]).flatMap(r=>musclesForExercise(r.exercise||r))),cl=x=>on.has(x)||on.has("全身")?"muscle-on":"muscle-off";
 const front=`<div class="muscle-figure"><div class="muscle-figure-label">FRONT</div><svg viewBox="0 0 120 240" role="img" aria-label="正面の筋肉"><circle class="muscle-body" cx="60" cy="20" r="14"/><path class="muscle-body" d="M48 38Q60 32 72 38L80 88Q75 108 70 118L73 148L86 195L80 228L67 228L61 176L58 147L55 176L49 228L36 228L30 195L43 148L46 118Q39 108 36 88Z"/><path class="muscle-body" d="M40 47Q24 50 18 76L10 132L22 136L36 90Z"/><path class="muscle-body" d="M80 47Q96 50 102 76L110 132L98 136L84 90Z"/><ellipse class="${cl("肩")}" cx="37" cy="54" rx="11" ry="13"/><ellipse class="${cl("肩")}" cx="83" cy="54" rx="11" ry="13"/><path class="${cl("胸")}" d="M44 55Q51 50 58 56L57 78Q50 83 43 77Z"/><path class="${cl("胸")}" d="M62 56Q69 50 76 55L77 77Q70 83 63 78Z"/><rect class="${cl("腹筋")}" x="51" y="81" width="18" height="34" rx="8"/><ellipse class="${cl("二頭")}" cx="28" cy="84" rx="8" ry="18"/><ellipse class="${cl("二頭")}" cx="92" cy="84" rx="8" ry="18"/><ellipse class="${cl("大腿四頭筋")}" cx="47" cy="166" rx="11" ry="29"/><ellipse class="${cl("大腿四頭筋")}" cx="73" cy="166" rx="11" ry="29"/><ellipse class="${cl("ふくらはぎ")}" cx="42" cy="210" rx="8" ry="18"/><ellipse class="${cl("ふくらはぎ")}" cx="78" cy="210" rx="8" ry="18"/></svg></div>`;
 const back=`<div class="muscle-figure"><div class="muscle-figure-label">BACK</div><svg viewBox="0 0 120 240" role="img" aria-label="背面の筋肉"><circle class="muscle-body" cx="60" cy="20" r="14"/><path class="muscle-body" d="M48 38Q60 32 72 38L80 88Q75 108 70 118L73 148L86 195L80 228L67 228L61 176L58 147L55 176L49 228L36 228L30 195L43 148L46 118Q39 108 36 88Z"/><path class="muscle-body" d="M40 47Q24 50 18 76L10 132L22 136L36 90Z"/><path class="muscle-body" d="M80 47Q96 50 102 76L110 132L98 136L84 90Z"/><ellipse class="${cl("肩")}" cx="37" cy="54" rx="11" ry="13"/><ellipse class="${cl("肩")}" cx="83" cy="54" rx="11" ry="13"/><path class="${cl("広背筋")}" d="M40 55Q60 46 80 55L75 103Q67 116 60 119Q53 116 45 103Z"/><rect class="${cl("脊柱起立筋")}" x="55" y="64" width="10" height="54" rx="5"/><ellipse class="${cl("三頭")}" cx="28" cy="84" rx="8" ry="18"/><ellipse class="${cl("三頭")}" cx="92" cy="84" rx="8" ry="18"/><ellipse class="${cl("臀筋")}" cx="48" cy="132" rx="13" ry="13"/><ellipse class="${cl("臀筋")}" cx="72" cy="132" rx="13" ry="13"/><ellipse class="${cl("ハム")}" cx="47" cy="168" rx="10" ry="28"/><ellipse class="${cl("ハム")}" cx="73" cy="168" rx="10" ry="28"/><ellipse class="${cl("ふくらはぎ")}" cx="42" cy="210" rx="8" ry="18"/><ellipse class="${cl("ふくらはぎ")}" cx="78" cy="210" rx="8" ry="18"/></svg></div>`;
 return `<div class="muscle-wrap"><div class="muscle-figures">${front}${back}</div><div class="muscle-labels">${[...on].slice(0,6).map(x=>`<span class="muscle-chip">${esc(x)}</span>`).join("")}</div></div>`
};

const baseSchedule=window.renderSchedule;
window.renderSchedule=function(){
 baseSchedule();
 const root=$("#schedule"),hiddenRaw=typeof _rawMergedSchedule==="function"?_rawMergedSchedule():[],keys=new Set(JSON.parse(localStorage.getItem("axis_hidden_schedule_v1")||"[]")),hidden=hiddenRaw.filter(x=>keys.has(scheduleKey(x)));
 if(!root.querySelector(".ax-restore-box")){
   const box=document.createElement("details");box.className="ax-collapsible ax-restore-box";
   box.innerHTML=`<summary>非表示予定を管理（${hidden.length}件）</summary><div style="margin-top:9px">${hidden.length?hidden.map(s=>`<div class="ax-schedule"><div class="ax-schedule-time"><strong>${esc(s.time)}</strong><span>OFF</span></div><div class="ax-schedule-main"><b>${esc(s.label||s.client)}</b><div class="subline">${esc(s.date)}</div></div><button class="btn soft" onclick="restoreScheduleItem('${String(scheduleKey(s)).replace(/'/g,"\\'")}')">戻す</button></div>`).join(""):'<div class="ax-muted">現在、非表示にしている予定はありません。</div>'}</div>`;
   root.appendChild(box)
 }
};

const baseInput=window.renderInput;
window.renderInput=function(p={}){
 baseInput(p);
 const det=$("#input .ax-memo details.ax-collapsible");
 if(det){det.open=true;const sm=det.querySelector("summary");if(sm)sm.textContent="注意点・共有事項・次回やること"}
};

const baseAnalysis=window.analysisHTML;
window.analysisHTML=function(c){
 let html=baseAnalysis(c);
 const actions=`<div class="ax-top-actions"><button class="btn soft" onclick="openSummary('${String(c).replace(/'/g,"\\'")}')">共有レポート</button><button class="btn soft" onclick="setTimeout(()=>document.querySelector('#lineText')?.scrollIntoView({behavior:'smooth'}),10)">LINE文面</button></div>`;
 return html.replace('</div><div class="ax-metric-grid">','</div>'+actions+'<div class="ax-metric-grid">')
};
})();
