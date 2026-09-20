/* AXIS v16 report UX + customer registry
   - Keeps training/calendar history untouched.
   - Customer status/goal overrides live in localStorage only.
   - Retiring a customer never deletes training records. */
(function(){
"use strict";

const REG_KEY="axis_client_registry_v1";
const S=s=>document.querySelector(s);
const oldClientList=window.clientList;
const oldRenderClients=window.renderClients;
const oldRenderMore=window.renderMore;

function token(s){
  return btoa(encodeURIComponent(String(s||""))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
}
function untoken(s){
  let x=String(s||"").replace(/-/g,"+").replace(/_/g,"/");
  while(x.length%4)x+="=";
  return decodeURIComponent(atob(x));
}
function readRegistry(){
  try{
    const v=JSON.parse(localStorage.getItem(REG_KEY)||"{}");
    return v&&typeof v==="object"&&!Array.isArray(v)?v:{};
  }catch(e){ return {}; }
}
function writeRegistry(v){ localStorage.setItem(REG_KEY,JSON.stringify(v)); }
function baseClients(){
  try{return typeof oldClientList==="function"?oldClientList():[]}catch(e){return []}
}
function effectiveGoal(name,rec){
  if(rec&&rec.goalSet) return String(rec.goal||"");
  return String((typeof META!=="undefined"&&META.goals&&META.goals[name])||"");
}
function syncGoalOverrides(){
  if(typeof META==="undefined") return;
  META.goals=META.goals||{};
  const reg=readRegistry();
  Object.values(reg).forEach(rec=>{
    if(!rec||!rec.name||!rec.goalSet)return;
    if(String(rec.goal||"").trim()) META.goals[rec.name]=String(rec.goal).trim();
    else delete META.goals[rec.name];
  });
}
function allClients(){
  syncGoalOverrides();
  const map=new Map;
  baseClients().forEach(x=>map.set(x.name,{...x,active:true,managed:false}));
  const reg=readRegistry();
  Object.values(reg).forEach(rec=>{
    if(!rec||!String(rec.name||"").trim())return;
    const name=String(rec.name).trim(),base=map.get(name)||{name,days:0,rows:0};
    map.set(name,{...base,active:rec.active!==false,managed:true,goal:effectiveGoal(name,rec),retiredAt:rec.retiredAt||"",createdAt:rec.createdAt||""});
  });
  return [...map.values()].map(x=>({...x,goal:x.goal!==undefined?x.goal:effectiveGoal(x.name,reg[x.name])}))
    .sort((a,b)=>a.name.localeCompare(b.name,"ja"));
}
window.axisAllClients=allClients;
window.clientList=function(){ return allClients().filter(x=>x.active!==false); };
window.axisClientGoal=function(name){const rec=readRegistry()[name];return effectiveGoal(name,rec)};

function ensureAdminView(){
  if(S("#clientAdmin"))return;
  const x=document.createElement("section");
  x.id="clientAdmin";x.className="view";
  S(".main")?.appendChild(x);
}
function refreshClientScreens(){
  syncGoalOverrides();
  if(typeof renderClients==="function")renderClients();
  if(typeof renderHome==="function")renderHome();
  if(S("#analytics")?.classList.contains("on")&&typeof renderAnalytics==="function")renderAnalytics();
}
function clientCardAdmin(c){
  const t=token(c.name),reg=readRegistry()[c.name]||{},goal=effectiveGoal(c.name,reg);
  return '<div class="axcm-card '+(c.active===false?"off":"on")+'">'+
    '<div class="axcm-cardtop"><div><b>'+esc(c.name)+'</b><span>'+c.days+'日 / '+c.rows+'種目</span></div>'+
      '<i>'+(c.active===false?"退会済み":"在籍")+'</i></div>'+
    '<label>目的・目標</label><div class="axcm-goal"><input id="axcm-goal-'+t+'" value="'+esc(goal)+'" placeholder="例：筋肥大・フォーム改善"><button onclick="axisSaveClientGoalToken(\''+t+'\')">保存</button></div>'+
    '<div class="axcm-actions"><button class="soft" onclick="axisOpenClientToken(\''+t+'\')">記録を見る</button>'+
      (c.active===false?'<button class="restore" onclick="axisSetClientActiveToken(\''+t+'\',true)">再開する</button>':'<button class="retire" onclick="axisSetClientActiveToken(\''+t+'\',false)">退会扱い</button>')+
    '</div>'+
    (c.active===false&&c.retiredAt?'<div class="axcm-retired">退会処理：'+esc(c.retiredAt.slice(0,10))+'　※履歴は保存されています</div>':'')+
  '</div>';
}
window.renderClientAdmin=function(){
  ensureAdminView();
  const list=allClients(),active=list.filter(x=>x.active!==false),off=list.filter(x=>x.active===false);
  S("#clientAdmin").innerHTML=
    '<div class="axcm-head"><button onclick="show(\'clients\',false);renderClients()">‹</button><div><span class="ax16-eyebrow">CUSTOMER MANAGEMENT</span><h2>顧客管理</h2><p>新規追加・退会・再開をここで管理します。過去記録は削除しません。</p></div></div>'+
    '<section class="ax16-panel axcm-new"><div class="ax16-head"><div class="ax16-h"><span class="ic">'+v16Icon("plus")+'</span>新規お客様</div></div>'+
      '<div class="axcm-newgrid"><input id="axcmName" placeholder="お客様名"><input id="axcmGoal" placeholder="目的・目標（任意）"><button class="ax16-btn pri" onclick="axisAddClient()">追加</button></div>'+
      '<div class="axcm-note">追加すると「利用者一覧」と「トレ中入力」の選択肢にすぐ反映されます。</div></section>'+
    '<div class="axcm-summary"><div><b>'+active.length+'</b><span>在籍</span></div><div><b>'+off.length+'</b><span>退会済み</span></div></div>'+
    '<div class="axcm-section"><div class="axcm-title"><b>在籍中</b><span>'+active.length+'名</span></div><div class="axcm-list">'+(active.length?active.map(clientCardAdmin).join(""):'<div class="axp-empty">在籍中のお客様はいません</div>')+'</div></div>'+
    '<details class="axcm-section axcm-off"><summary>退会済み <b>'+off.length+'</b></summary><div class="axcm-list">'+(off.length?off.map(clientCardAdmin).join(""):'<div class="axp-muted">退会済みのお客様はいません。</div>')+'</div></details>';
};
window.axisOpenClientAdmin=function(focusNew){
  ensureAdminView();show("clientAdmin",false);renderClientAdmin();
  if(focusNew)setTimeout(()=>S("#axcmName")?.focus(),80);
};
window.axisAddClient=function(){
  const name=String(S("#axcmName")?.value||"").trim(),goal=String(S("#axcmGoal")?.value||"").trim();
  if(!name){alert("お客様名を入力してください");return}
  const existing=allClients().find(x=>x.name===name),reg=readRegistry();
  if(existing&&existing.active!==false){alert("このお客様はすでに在籍中です");return}
  const prev=reg[name]||{};
  reg[name]={...prev,name,active:true,goal,goalSet:true,createdAt:prev.createdAt||new Date().toISOString(),retiredAt:""};
  writeRegistry(reg);syncGoalOverrides();renderClientAdmin();refreshClientScreens();
  setTimeout(()=>S("#axcmName")?.focus(),50);
};
window.axisSetClientActiveToken=function(t,active){
  const name=untoken(t),reg=readRegistry(),prev=reg[name]||{name};
  if(!active&&!confirm(name+"さんを退会扱いにしますか？\n\nトレーニング履歴は削除されません。"))return;
  reg[name]={...prev,name,active:!!active,retiredAt:active?"":new Date().toISOString()};
  writeRegistry(reg);renderClientAdmin();refreshClientScreens();
};
window.axisSaveClientGoalToken=function(t){
  const name=untoken(t),input=S("#axcm-goal-"+t),goal=String(input?.value||"").trim(),reg=readRegistry(),prev=reg[name]||{name,active:true};
  reg[name]={...prev,name,goal,goalSet:true};
  writeRegistry(reg);syncGoalOverrides();renderClientAdmin();refreshClientScreens();
};
window.axisOpenClientToken=function(t){const name=untoken(t);show("detail",false);openClient(name)};

// Add customer-management entry without replacing existing More tools.
window.renderMore=function(){
  if(typeof oldRenderMore==="function")oldRenderMore();
  const root=S("#more");if(!root)return;
  const list=allClients(),active=list.filter(x=>x.active!==false).length,off=list.length-active;
  const card=document.createElement("div");card.className="ax16-panel axcm-entry";
  card.innerHTML='<div class="ax16-head"><div class="ax16-h"><span class="ic">'+v16Icon("users")+'</span>顧客管理</div><span class="ax16-mut">在籍 '+active+' / 退会 '+off+'</span></div>'+
    '<p>新規のお客様追加、目的変更、退会・再開を安全に管理します。退会しても過去記録は残ります。</p>'+
    '<button class="ax16-btn pri full" onclick="axisOpenClientAdmin(true)">顧客管理を開く '+v16Icon("chev")+'</button>';
  root.prepend(card);
};

// Add a clear management action to the client list.
window.renderClients=function(){
  if(typeof oldRenderClients==="function")oldRenderClients();
  const root=S("#clients");if(!root)return;
  const head=root.querySelector(".axp-head");
  if(head&&!root.querySelector(".axcm-clienttools")){
    const bar=document.createElement("div");bar.className="axcm-clienttools";
    bar.innerHTML='<span><b>'+clientList().length+'</b>名 在籍</span><div><button onclick="axisOpenClientAdmin(true)">＋ 新規</button><button onclick="axisOpenClientAdmin(false)">顧客管理</button></div>';
    head.insertAdjacentElement("afterend",bar);
  }
};

/* ----- Report UX ----- */
function metric(c){
  if(typeof axisClientMetrics==="function")return axisClientMetrics(c);
  return {last:null,prev:null,lastVol:0,delta:0,vols:[],parts:[]};
}
function deltaText(m){return m.prev?((m.delta>0?"+":"")+m.delta+"%"):"比較なし"}
function muscleNames(rows){
  const on=new Set((rows||[]).flatMap(r=>typeof musclesForExercise==="function"?musclesForExercise(r.exercise||r):[]));
  return [...on].filter(x=>x!=="全身").slice(0,8);
}
function nextLabel(c){
  return typeof nextTrainingText==="function"?nextTrainingText(c):"未登録";
}
window.axisSetReportShareMode=function(on){
  document.body.classList.toggle("axis-share-mode",!!on);
  const b=S("#axisShareToggle");
  if(b)b.textContent=on?"通常表示へ戻す":"スクショ用";
  scrollTo(0,0);
};
window.axisBackFromReport=function(c){
  document.body.classList.remove("axis-share-mode");
  openClient(c);
};
window.openSummary=function(c){
  syncGoalOverrides();
  document.body.classList.remove("axis-share-mode");
  const hist=sessions(c),last=hist[0],a=analyzeClient(c),m=metric(c),rows=last?.rows||[];
  const adv=(typeof professionalAdvice==="function"?professionalAdvice(c):a.advice)||[];
  const reportDate=last?jp(last.date):jp(today()),next=a.next?.[0],vol=Math.round(sessionVolume(last||{rows:[]}));
  const muscles=muscleNames(rows),goal=axisClientGoal(c)||"コンディションとフォームを確認しながら継続";
  show("summary",false);
  S("#summary").innerHTML=
    '<div class="axu-safe"></div>'+
    '<div class="axu-screen-controls"><button class="axu-back" onclick="axisBackFromReport(\''+String(c).replace(/'/g,"\\'")+'\')">‹ 戻る</button><button id="axisShareToggle" class="axu-share" onclick="axisSetReportShareMode(true)">スクショ用</button></div>'+
    '<div class="axp-report axu-report">'+
      '<div class="axp-reporthero axu-hero"><div><div class="ax16-logo">A<i>X</i>IS<small>TRAINING</small></div><span>SESSION REPORT</span></div><div class="axp-reportdate"><span>DATE</span><b>'+esc(reportDate)+'</b></div></div>'+
      '<div class="axp-reportclient axu-client"><div><span class="ax16-eyebrow">CLIENT</span><h2>'+esc(displayClientName(c))+'</h2><p>'+esc(goal)+'</p></div><div class="axp-check">✓</div></div>'+
      '<div class="axp-reportkpi axu-kpi"><div><span>総ボリューム</span><b>'+vol.toLocaleString()+'<small>kg</small></b></div><div><span>前回比</span><b>'+esc(deltaText(m))+'</b></div><div><span>メニュー</span><b>'+rows.length+'<small>種目</small></b></div></div>'+
      '<section class="axu-card axu-menu"><div class="axp-rtitle"><b>今日のメニュー</b><span>TOTAL '+rows.length+'</span></div>'+
        (rows.length?rows.slice(0,8).map((r,i)=>'<div class="axp-menurow"><i>'+String(i+1).padStart(2,"0")+'</i><b>'+esc(r.exercise)+'</b><span>'+esc(r.weight)+(typeof r.weight==="number"?"kg":"")+' / '+esc(r.reps)+'回 / '+esc(r.sets)+'set</span></div>').join(""):'<div class="axp-muted">記録はありません。</div>')+
      '</section>'+
      '<section class="axu-card axu-muscle-summary"><div class="axp-rtitle"><b>鍛えた部位</b><span>'+muscles.length+'部位</span></div><div class="axu-musclechips">'+(muscles.length?muscles.map(x=>'<span>'+esc(x)+'</span>').join(""):'<span>記録なし</span>')+'</div></section>'+
      '<details class="axu-card axu-fold axu-muscle-fold"><summary><span>人体図を見る</span><small>FRONT / BACK</small></summary><div class="axu-foldbody">'+muscleMap(rows)+'</div></details>'+
      '<section class="axu-card axu-advice"><div class="axp-rtitle"><b>COACH\'S ADVICE</b><span>POINT</span></div><p>'+esc(adv[0]||"無理のない範囲で継続していきましょう。")+'</p></section>'+
      '<section class="axu-card axu-next"><div><span class="ax16-eyebrow">NEXT SESSION</span><small>次回予約</small><b>'+esc(nextLabel(c))+'</b></div><div><small>次回提案</small><b>'+esc(next?.exercise||"状態を見ながら調整")+'</b><p>'+esc(next?.text||"")+'</p></div></section>'+
      '<details class="axu-card axu-fold axu-analysis-fold"><summary><span>ボリューム推移を見る</span><small>RECENT</small></summary><div class="axu-foldbody">'+axisSparkline(m.vols)+'</div></details>'+
      '<div class="axp-reportfoot">SMALL STEPS MAKE BIG CHANGES.</div>'+
    '</div>'+
    '<button class="axu-share-exit" onclick="axisSetReportShareMode(false)">通常表示へ戻す</button>';
};

ensureAdminView();
syncGoalOverrides();
})();