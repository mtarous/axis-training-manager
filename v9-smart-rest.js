(function(){
let sessionStartedAt=0,sessionTicker=null,lastSuggested=90;
window.getSession40State=()=>({startedAt:sessionStartedAt});
window.resetSession40=function(){clearInterval(sessionTicker);sessionTicker=null;sessionStartedAt=0;updateSessionClock()};
window.isCompoundExercise=function(name){return /スクワット|ベンチ|デッド|rdl|プレス|ラット|プルダウン|ロー|ブルガリアン|ランジ|ヒップスラスト|懸垂/i.test(String(name||""))};
window.isPowerExercise=function(name){return /ジャンプ|ホップ|スプリント|クリーン|スナッチ|jump|hop/i.test(String(name||""))};
window.smartRestSeconds=function(e,client,rpe){
 const reps=Number(e?.reps||10),R=Number(rpe||0),compound=isCompoundExercise(e?.exercise),power=isPowerExercise(e?.exercise); let sec;
 if(power)sec=150; else if(compound&&reps<=5)sec=180; else if(compound&&reps<=8)sec=150; else if(compound)sec=120; else if(reps<=8)sec=105; else if(reps<=12)sec=90; else sec=60;
 if(R>=9)sec+=30; else if(R&&R<=6)sec-=15;
 const prev=client?latest(client):null,pr=prev?.rows?.find(x=>x.exercise===e.exercise),w=parseFloat(e?.weight),pw=parseFloat(pr?.weight);
 if(Number.isFinite(w)&&Number.isFinite(pw)&&pw>0){const gain=(w-pw)/pw;if(gain>=.1)sec+=30;else if(gain>=.05)sec+=15}
 return Math.max(45,Math.min(240,Math.round(sec/15)*15))
};
window.startSession40=function(){if(sessionStartedAt)return;sessionStartedAt=Date.now();sessionTicker=setInterval(updateSessionClock,1000);updateSessionClock()};
window.updateSessionClock=function(){const el=$("#session40");if(!el)return;const used=sessionStartedAt?(Date.now()-sessionStartedAt)/1000:0,left=Math.max(0,2400-used),pct=Math.min(100,used/2400*100);el.innerHTML=`<div class="session-clock"><div><b>40分 SESSION</b><div class="session-track"><div class="session-fill" style="width:${pct}%"></div></div></div><strong>${Math.floor(left/60)}:${String(Math.floor(left%60)).padStart(2,"0")}</strong></div>`};
window.showSmartRest=function(i){
 const e=exs[i],client=$("#fclient")?.value||"",rpe=$("#frpe")?.value||"",sec=smartRestSeconds(e,client,rpe);lastSuggested=sec;
 const box=$("#smartRest");if(!box)return;box.innerHTML=`<div><span class="sub">推奨休憩 · ${esc(e.exercise||"種目")}</span><br><strong>${Math.floor(sec/60)}:${String(sec%60).padStart(2,"0")}</strong><div class="sub">回数 ${e.reps} / ${isCompoundExercise(e.exercise)?"多関節":"補助種目"}${rpe?` / RPE ${rpe}`:""}</div></div><button class="btn primary" onclick="startTimer(${sec})">この時間で開始</button>`
};
const oldRender=window.renderInput;
window.renderInput=function(p){oldRender(p);const input=$("#input"),timer=input.querySelector(".timerbar");if(timer){const s=document.createElement("div");s.id="session40";s.className="smart-rest";s.innerHTML='<button class="btn primary" onclick="startSession40()">40分セッション開始</button>';timer.after(s);const r=document.createElement("div");r.id="smartRest";r.className="smart-rest";r.innerHTML='<span class="sub">セット完了後に、種目・回数・RPE・前回重量から休憩を提案します。</span>';s.after(r)}};
const oldToggle=window.toggleSet;
window.toggleSet=function(i,j){oldToggle(i,j);if(!sessionStartedAt)startSession40();showSmartRest(i)};
})();
window.jp=function(d){if(!d)return "";const x=new Date(String(d).slice(0,10)+"T00:00:00+09:00");if(Number.isNaN(x.getTime()))return String(d);const w=["日","月","火","水","木","金","土"][x.getDay()];return x.getFullYear()+"年"+(x.getMonth()+1)+"月"+x.getDate()+"日 ("+w+")"};
window.renderAll=function(){for(const f of [renderHome,renderSchedule,renderClients,renderHistory]){try{f()}catch(e){console.error("AXIS render",e)}}};
