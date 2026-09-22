/* AXIS v16 remaining screens
   Presentation-only overrides for clients / schedule / analytics / session report. */
(function(){
"use strict";
const S=s=>document.querySelector(s);
const jsq=s=>String(s||"").replace(/\\/g,"\\\\").replace(/'/g,"\\'");
const metric=c=>typeof axisClientMetrics==="function"?axisClientMetrics(c):{hist:[],last:null,prev:null,lastVol:0,delta:0,vols:[],parts:[]};
const change=m=>m.prev?((m.delta>0?"+":"")+m.delta+"%"):"比較なし";
const header=(ey,title,sub)=>'<div class="axp-head"><span class="ax16-eyebrow">'+ey+'</span><h2>'+title+'</h2>'+(sub?'<p>'+sub+'</p>':'')+'</div>';

function clientCard(x){
 const c=x.name,m=metric(c),last=m.last,goal=META.goals?.[c]||"目標未登録";
 return '<button class="axp-client" onclick="openClient(\''+jsq(c)+'\')">'+
  '<div class="axp-clienttop"><div class="axp-avatar">'+v16Icon("users")+'</div><div class="axp-clientname"><b>'+esc(c)+'</b><span>'+esc(goal)+'</span></div><div class="axp-chev">'+v16Icon("chev")+'</div></div>'+
  '<div class="axp-clientstats"><div><strong>'+x.days+'</strong><span>実施日</span></div><div><strong>'+x.rows+'</strong><span>記録種目</span></div><div><strong>'+m.lastVol.toLocaleString()+'</strong><span>直近負荷 kg</span></div></div>'+
  '<div class="axp-clientfoot"><span>'+(last?('直近 '+esc(fmt(last.date))):"記録なし")+'</span><i class="'+(m.prev?(m.delta>0?"up":m.delta<0?"dn":"flat"):"flat")+'">'+change(m)+'</i></div>'+
 '</button>';
}

window.renderClients=function(){
 const root=S("#clients");if(!root)return;
 const allClients=clientList();
 root.innerHTML=header("CLIENTS","利用者","目標・実施状況・直近のトレーニングを一覧で確認。")+
  '<div class="axp-search"><span>⌕</span><input id="q" placeholder="利用者名で検索"></div>'+
  '<div class="axp-clientcount"><b>'+allClients.length+'</b> CLIENTS</div><div id="cgrid" class="axp-clientgrid"></div>';
 const draw=()=>{const q=(S("#q")?.value||"").trim();const list=allClients.filter(c=>!q||c.name.includes(q));S("#cgrid").innerHTML=list.length?list.map(clientCard).join(""):'<div class="axp-empty">該当する利用者はいません</div>'};
 draw();S("#q").oninput=draw;
};

function scheduleCard(s){
 const known=clientList().some(x=>x.name===s.client),last=s.type==="パーソナル"?latest(s.client,s.date):null;
 const label=String(s.label||s.client||"予定"),key=scheduleKey(s);
 return '<div class="axp-schedule '+(known?"clickable":"")+'" '+(known?'onclick="openClient(\''+jsq(s.client)+'\')"':"")+'>'+
  '<div class="axp-time"><b>'+esc(s.time||"--:--")+'</b><span>'+(s.type==="パーソナル"?"PT":esc(s.type||"予定"))+'</span></div>'+
  '<div class="axp-schmain"><b>'+esc(label)+'</b><p>'+(known&&META.goals?.[s.client]?esc(META.goals[s.client]):s.calendar?"Google Calendar":"AXIS TRAINING")+'</p>'+
  '<div class="axp-tags">'+(last?'<span>'+last.rows.length+'種目</span>':"")+(s.type==="パーソナル"?'<span>40分</span>':"")+(s.calendar?'<span>Calendar</span>':"")+'</div></div>'+
  '<button class="axp-hide" title="AXIS上だけ非表示" onclick="event.stopPropagation();hideScheduleItem(\''+jsq(key)+'\',\''+jsq(label)+'\')">×</button>'+
 '</div>';
}
window.renderSchedule=function(){
 const root=S("#schedule");if(!root)return;
 const items=mergedSchedule(),raw=typeof _rawMergedSchedule==="function"?_rawMergedSchedule():items;
 let hiddenKeys=[];try{hiddenKeys=JSON.parse(localStorage.getItem("axis_hidden_schedule_v1")||"[]")}catch(e){}
 const hiddenSet=new Set(Array.isArray(hiddenKeys)?hiddenKeys:[]),hidden=raw.filter(x=>hiddenSet.has(scheduleKey(x)));
 const groups=new Map();items.forEach(x=>{if(!groups.has(x.date))groups.set(x.date,[]);groups.get(x.date).push(x)});
 root.innerHTML=header("SCHEDULE","スケジュール","")+calendarSyncNotice()+
  ([...groups.entries()].map(([date,list])=>'<section class="axp-day"><div class="axp-dayhead"><b>'+esc(jp(date))+'</b><span>'+list.length+'件</span></div><div class="axp-schedulelist">'+list.map(scheduleCard).join("")+'</div></section>').join("")||'<div class="axp-empty">予定はありません</div>')+
  '<details class="axp-hidden"><summary>非表示予定を管理 <b>'+hidden.length+'</b></summary><div class="axp-hiddenbody">'+
   (hidden.length?hidden.map(x=>'<div class="axp-hiddenrow"><div><b>'+esc(x.time||"--:--")+' '+esc(x.label||x.client||"予定")+'</b><span>'+esc(x.date)+'</span></div><button onclick="restoreScheduleItem(\''+jsq(scheduleKey(x))+'\')">戻す</button></div>').join(""):'<div class="axp-muted">非表示の予定はありません。</div>')+
   (hidden.length?'<button class="axp-restoreall" onclick="restoreAllScheduleItems()">すべて戻す</button>':"")+
  '</div></details>';
};

window.v16AnalyticsRange=window.v16AnalyticsRange||"week";
window.v16SetAnalyticsRange=function(r){window.v16AnalyticsRange=r;renderAnalytics()};
window.renderAnalytics=function(){
 const root=S("#analytics");if(!root)return;
 const st=v16Stats(),range=window.v16AnalyticsRange||"week",series=v16Series(range),total=series.reduce((a,x)=>a+(Number(x.v)||0),0);
 const clients=clientList().map(c=>({c:c.name,m:metric(c.name)}));
 const tabs=[["week","今週"],["month","今月"],["q","3か月"],["year","1年"]];
 root.innerHTML=header("ANALYTICS","データ分析","全体のトレーニング量と利用者ごとの変化を確認。")+
 '<div class="axp-kpis"><div><span>今月のセッション</span><b>'+st.month+'<small>回</small></b></div><div><span>今週の総ボリューム</span><b>'+st.week.toLocaleString()+'<small>kg</small></b></div><div><span>継続率</span><b>'+st.rate+'<small>%</small></b></div></div>'+
 '<section class="ax16-panel axp-analyticschart"><div class="ax16-head"><div class="ax16-h"><span class="ic">'+v16Icon("chart")+'</span>トレーニングボリューム</div><strong>'+total.toLocaleString()+' kg</strong></div>'+
 '<div class="ax16-seg">'+tabs.map(t=>'<button class="'+(range===t[0]?"on":"")+'" onclick="v16SetAnalyticsRange(\''+t[0]+'\')">'+t[1]+'</button>').join("")+'</div>'+axisBarChart(series)+'</section>'+
 '<div class="axp-sectiontitle"><span class="ax16-eyebrow">CLIENT ANALYTICS</span><b>'+clients.length+'名</b></div>'+
 '<div class="axp-analyticclients">'+clients.map(x=>{
   const l=x.m.last;
   return '<button onclick="openClient(\''+jsq(x.c)+'\')"><div><b>'+esc(x.c)+'</b><span>'+(l?esc(fmt(l.date)):"記録なし")+'</span></div><div class="axp-anmetric"><strong>'+x.m.lastVol.toLocaleString()+'<small>kg</small></strong><i class="'+(x.m.prev?(x.m.delta>0?"up":x.m.delta<0?"dn":"flat"):"flat")+'">'+change(x.m)+'</i></div><span class="axp-chev">'+v16Icon("chev")+'</span></button>';
 }).join("")+'</div>';
};

window.openSummary=function(c){
 const hist=sessions(c),last=hist[0],a=analyzeClient(c),m=metric(c),rows=last?.rows||[],adv=(typeof professionalAdvice==="function"?professionalAdvice(c):a.advice)||[];
 const reportDate=last?jp(last.date):jp(today()),next=a.next?.[0],vol=Math.round(sessionVolume(last||{rows:[]}));
 show("summary",false);
 S("#summary").innerHTML='<div class="axp-report">'+
  '<div class="axp-reporthero"><div><div class="ax16-logo">A<i>X</i>IS<small>TRAINING</small></div><span>SESSION REPORT</span></div><div class="axp-reportdate"><span>DATE</span><b>'+esc(reportDate)+'</b></div></div>'+
  '<div class="axp-reportclient"><div><span class="ax16-eyebrow">CLIENT</span><h2>'+esc(displayClientName(c))+'</h2><p>'+esc(META.goals?.[c]||"継続してコンディションとフォームを確認していきます。")+'</p></div><div class="axp-check">✓</div></div>'+
  '<div class="axp-reportkpi"><div><span>総ボリューム</span><b>'+vol.toLocaleString()+'<small>kg</small></b></div><div><span>前回比</span><b>'+esc(change(m))+'</b></div><div><span>メニュー</span><b>'+rows.length+'<small>種目</small></b></div></div>'+
  '<div class="axp-reportgrid"><section><div class="axp-rtitle"><b>今日のメニュー</b><span>TOTAL '+rows.length+'</span></div>'+
   (rows.length?rows.slice(0,8).map((r,i)=>'<div class="axp-menurow"><i>'+String(i+1).padStart(2,"0")+'</i><b>'+esc(r.exercise)+'</b><span>'+esc(r.weight)+(typeof r.weight==="number"?"kg":"")+' / '+esc(r.reps)+'回 / '+esc(r.sets)+'set</span></div>').join(""):'<div class="axp-muted">記録はありません。</div>')+
  '</section><section class="axp-rmuscle"><div class="axp-rtitle"><b>鍛えた部位</b></div>'+muscleMap(rows)+'</section></div>'+
  '<div class="axp-reportgrid lower"><section><div class="axp-rtitle"><b>ボリューム推移</b><span>RECENT</span></div>'+axisSparkline(m.vols)+'</section>'+
   '<section><div class="axp-rtitle"><b>COACH\'S ADVICE</b></div><p class="axp-advice">'+esc(adv[0]||"無理のない範囲で継続していきましょう。")+'</p></section></div>'+
  '<section class="axp-next"><div><span class="ax16-eyebrow">NEXT SESSION</span><b>'+esc(typeof nextTrainingText==="function"?nextTrainingText(c):"未登録")+'</b></div><div><span>おすすめ</span><b>'+esc(next?.exercise||"状態を見ながら調整")+'</b><p>'+esc(next?.text||"")+'</p></div></section>'+
  '<div class="axp-reportfoot">SMALL STEPS MAKE BIG CHANGES.</div></div>'+
  '<div class="axp-reportactions"><button class="ax16-btn soft" onclick="openClient(\''+jsq(c)+'\')">戻る</button><button class="ax16-btn pri" onclick="alert(\'この画面をそのままスクリーンショットしてください\')">スクショ用</button></div>';
};
})();
