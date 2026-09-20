/* AXIS v16 customer portability + stable identity
   Presentation/data overlay only. Raw BASE, added, META.schedule and calendar data are never rewritten. */
(function(){
"use strict";
const REG_KEY="axis_client_registry_v1";
const EDIT_KEY="axis_training_edits_v1";
const HIDE_KEY="axis_hidden_schedule_v1";
const S=s=>document.querySelector(s);
const baseAll=window.all;
const baseAppRows=window.appRows;
const baseRenderMore=window.renderMore;
const baseOpenSummary=window.openSummary;
const baseMergedSchedule=window.mergedSchedule;
const baseRawMergedSchedule=window._rawMergedSchedule;
const baseScheduleKey=window.scheduleKey;

function parseJSON(v,fallback){try{return JSON.parse(v)}catch(e){return fallback}}
function token(s){return btoa(encodeURIComponent(String(s||""))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"")}
function untoken(s){let x=String(s||"").replace(/-/g,"+").replace(/_/g,"/");while(x.length%4)x+="=";return decodeURIComponent(atob(x))}
function uniq(a){return [...new Set((a||[]).map(x=>String(x||"").trim()).filter(Boolean))]}
function hash32(s){let h=2166136261;for(const ch of String(s)){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)}return (h>>>0).toString(16).toUpperCase().padStart(8,"0")}
function legacyId(k){return "AX-"+hash32(k)}
function newId(){return "AX-"+Date.now().toString(36).toUpperCase()+"-"+Math.random().toString(36).slice(2,6).toUpperCase()}

function normalizeRecord(key,rec){
 rec=rec&&typeof rec==="object"?rec:{};
 const fallbackName=String(rec.name||(!String(key).startsWith("c_")?key:"")).trim();
 return {...rec,
   id:String(rec.id||legacyId(key)),
   name:fallbackName,
   aliases:uniq([...(Array.isArray(rec.aliases)?rec.aliases:[]),!String(key).startsWith("c_")?key:"",fallbackName]),
   active:rec.active!==false,
   sourceKey:String(rec.sourceKey||key)
 };
}
function readRegistry(){
 const raw=parseJSON(localStorage.getItem(REG_KEY)||"{}",{});
 if(!raw||typeof raw!=="object"||Array.isArray(raw))return {};
 const out={};Object.entries(raw).forEach(([k,v])=>out[k]=normalizeRecord(k,v));return out;
}
function writeRegistry(reg){localStorage.setItem(REG_KEY,JSON.stringify(reg))}
function findEntry(name,reg=readRegistry()){
 name=String(name||"").trim();
 return Object.entries(reg).find(([k,r])=>k===name||r.name===name||(r.aliases||[]).includes(name))||null;
}
function keyForName(name,reg=readRegistry()){const e=findEntry(name,reg);return e?e[0]:String(name||"")}
function displayNameFor(name,reg=readRegistry()){const e=findEntry(name,reg);return e&&e[1].name?e[1].name:String(name||"")}
function recordForName(name,reg=readRegistry()){const e=findEntry(name,reg);return e?e[1]:null}
function effectiveGoal(name,rec){
 if(rec&&rec.goalSet)return String(rec.goal||"");
 const aliases=uniq([name,...(rec?.aliases||[])]);
 for(const a of aliases){if(typeof META!=="undefined"&&META.goals&&META.goals[a]!=null)return String(META.goals[a]||"")}
 return "";
}
function syncMetaAliases(){
 if(typeof META==="undefined")return;
 META.goals=META.goals||{};META.attention=META.attention||{};
 const reg=readRegistry();
 Object.values(reg).forEach(rec=>{
   if(!rec?.name)return;
   const aliases=uniq(rec.aliases||[]);
   const g=effectiveGoal(rec.name,rec);
   if(rec.goalSet){if(g)META.goals[rec.name]=g;else delete META.goals[rec.name]}
   else if(g&&!META.goals[rec.name])META.goals[rec.name]=g;
   if(!META.attention[rec.name]){
     const src=aliases.find(a=>META.attention[a]);
     if(src)META.attention[rec.name]=META.attention[src];
   }
 });
}

function mapRowClient(r){
 if(!r||typeof r!=="object")return r;
 const n=displayNameFor(r.client);
 return n===r.client?r:{...r,client:n};
}
window.all=function(){return (typeof baseAll==="function"?baseAll():[]).map(mapRowClient)};
window.appRows=function(){return (typeof baseAppRows==="function"?baseAppRows():[]).map(mapRowClient)};

function mapScheduleItem(s){
 if(!s||typeof s!=="object")return s;
 const rawClient=String(s.client||""),display=displayNameFor(rawClient);
 if(display===rawClient)return s;
 const rawLabel=String(s.label||"");
 const label=rawLabel&&rawClient?rawLabel.replace(rawClient,display):rawLabel;
 return {...s,_axisOriginalClient:rawClient,_axisOriginalLabel:rawLabel,client:display,label};
}
if(typeof baseMergedSchedule==="function"){
 window.mergedSchedule=function(){return baseMergedSchedule().map(mapScheduleItem)}
}
if(typeof baseRawMergedSchedule==="function"){
 window._rawMergedSchedule=function(){return baseRawMergedSchedule().map(mapScheduleItem)}
}
if(typeof baseScheduleKey==="function"){
 window.scheduleKey=function(s){
   if(s&&s._axisOriginalClient){
     return baseScheduleKey({...s,client:s._axisOriginalClient,label:s._axisOriginalLabel||s.label});
   }
   return baseScheduleKey(s);
 }
}

function allClients(){
 syncMetaAliases();
 const stats=new Map();
 const rows=window.all();
 rows.forEach(r=>{
   const name=String(r.client||"").trim();if(!name)return;
   let x=stats.get(name);if(!x){x={name,days:new Set(),rows:0};stats.set(name,x)}
   if(r.date)x.days.add(r.date);x.rows++;
 });
 if(typeof META!=="undefined"&&META.goals){
   Object.keys(META.goals).forEach(raw=>{
     const name=displayNameFor(raw);if(!stats.has(name))stats.set(name,{name,days:new Set(),rows:0});
   });
 }
 const reg=readRegistry();
 Object.entries(reg).forEach(([key,rec])=>{
   if(!rec.name)return;
   if(!stats.has(rec.name))stats.set(rec.name,{name:rec.name,days:new Set(),rows:0});
 });
 return [...stats.values()].map(x=>{
   const entry=findEntry(x.name,reg),rec=entry?.[1]||null;
   return {name:x.name,days:x.days.size,rows:x.rows,active:rec?rec.active!==false:true,managed:!!rec,
     id:rec?.id||legacyId(x.name),goal:effectiveGoal(x.name,rec),retiredAt:rec?.retiredAt||"",createdAt:rec?.createdAt||""};
 }).sort((a,b)=>a.name.localeCompare(b.name,"ja"));
}
window.axisAllClients=allClients;
window.clientList=function(){return allClients().filter(x=>x.active!==false)};
window.axisClientGoal=function(name){const rec=recordForName(name);return effectiveGoal(displayNameFor(name),rec)};
window.axisClientId=function(name){const rec=recordForName(name);return rec?.id||legacyId(name)};

function ensureAdminView(){
 if(S("#clientAdmin"))return;
 const x=document.createElement("section");x.id="clientAdmin";x.className="view";S(".main")?.appendChild(x);
}
function refresh(){
 syncMetaAliases();
 if(typeof renderClients==="function")renderClients();
 if(typeof renderHome==="function")renderHome();
 if(S("#analytics")?.classList.contains("on")&&typeof renderAnalytics==="function")renderAnalytics();
 if(S("#schedule")?.classList.contains("on")&&typeof renderSchedule==="function")renderSchedule();
}
function adminKeyFor(c){
 const reg=readRegistry(),e=findEntry(c.name,reg);return e?e[0]:c.name;
}
function adminCard(c){
 const reg=readRegistry(),key=adminKeyFor(c),rec=reg[key]||normalizeRecord(key,{name:c.name,active:c.active}),t=token(key),goal=effectiveGoal(c.name,rec);
 return '<div class="axcm-card '+(c.active===false?"off":"on")+'">'+
  '<div class="axcm-cardtop"><div><b>'+esc(c.name)+'</b><span>ID '+esc(rec.id)+' ・ '+c.days+'日 / '+c.rows+'種目</span></div><i>'+(c.active===false?"退会済み":"在籍")+'</i></div>'+
  '<label>表示名</label><input class="axcm-name" id="axcm-name-'+t+'" value="'+esc(c.name)+'" placeholder="お客様名">'+
  '<label>目的・目標</label><input class="axcm-goalinput" id="axcm-goal-'+t+'" value="'+esc(goal)+'" placeholder="例：筋肥大・フォーム改善">'+
  '<div class="axcm-actions axcm-profile-actions"><button class="profile" onclick="axisSaveClientProfileToken(\''+t+'\')">名前・目標を保存</button><button class="soft" onclick="axisOpenClientToken(\''+t+'\')">記録を見る</button></div>'+
  '<div class="axcm-actions">'+
   (c.active===false?'<button class="restore" onclick="axisSetClientActiveToken(\''+t+'\',true)">再開する</button>':'<button class="retire" onclick="axisSetClientActiveToken(\''+t+'\',false)">退会扱い</button>')+
  '</div>'+
  (c.active===false&&c.retiredAt?'<div class="axcm-retired">退会処理：'+esc(c.retiredAt.slice(0,10))+'　※履歴は保存されています</div>':'')+
 '</div>';
}
window.renderClientAdmin=function(){
 ensureAdminView();
 const list=allClients(),active=list.filter(x=>x.active!==false),off=list.filter(x=>x.active===false);
 S("#clientAdmin").innerHTML=
  '<div class="axcm-head"><button onclick="show(\'clients\',false);renderClients()">‹</button><div><span class="ax16-eyebrow">CUSTOMER MANAGEMENT</span><h2>顧客管理</h2><p>追加・名前変更・目標変更・退会・再開を管理。過去記録は削除しません。</p></div></div>'+
  '<section class="ax16-panel axcm-new"><div class="ax16-head"><div class="ax16-h"><span class="ic">'+v16Icon("plus")+'</span>新規お客様</div></div>'+
   '<div class="axcm-newgrid"><input id="axcmName" placeholder="お客様名"><input id="axcmGoal" placeholder="目的・目標（任意）"><button class="ax16-btn pri" onclick="axisAddClient()">追加</button></div>'+
   '<div class="axcm-note">追加直後から利用者一覧・トレ中入力で選択できます。顧客IDは自動発行します。</div></section>'+
  '<div class="axcm-summary"><div><b>'+active.length+'</b><span>在籍</span></div><div><b>'+off.length+'</b><span>退会済み</span></div></div>'+
  '<div class="axcm-section"><div class="axcm-title"><b>在籍中</b><span>'+active.length+'名</span></div><div class="axcm-list">'+(active.length?active.map(adminCard).join(""):'<div class="axp-empty">在籍中のお客様はいません</div>')+'</div></div>'+
  '<details class="axcm-section axcm-off"><summary>退会済み <b>'+off.length+'</b></summary><div class="axcm-list">'+(off.length?off.map(adminCard).join(""):'<div class="axp-muted">退会済みのお客様はいません。</div>')+'</div></details>';
};
window.axisOpenClientAdmin=function(focusNew){
 ensureAdminView();show("clientAdmin",false);renderClientAdmin();requestPersistentStorage();
 if(focusNew)setTimeout(()=>S("#axcmName")?.focus(),80);
};
window.axisAddClient=function(){
 const name=String(S("#axcmName")?.value||"").trim(),goal=String(S("#axcmGoal")?.value||"").trim();
 if(!name){alert("お客様名を入力してください");return}
 const same=allClients().find(x=>x.name===name);
 if(same){alert(same.active===false?"同名の退会済み顧客があります。再開する場合は退会済み一覧から「再開する」を押してください。":"このお客様はすでに在籍中です。");return}
 const id=newId(),key="c_"+id,now=new Date().toISOString(),reg=readRegistry();
 reg[key]={id,name,aliases:[name],sourceKey:key,active:true,goal,goalSet:true,createdAt:now,updatedAt:now,retiredAt:""};
 writeRegistry(reg);syncMetaAliases();renderClientAdmin();refresh();
 setTimeout(()=>S("#axcmName")?.focus(),50);
};
window.axisSaveClientProfileToken=function(t){
 const key=untoken(t),reg=readRegistry(),old=reg[key]||normalizeRecord(key,{name:key,active:true});
 const name=String(S("#axcm-name-"+t)?.value||"").trim(),goal=String(S("#axcm-goal-"+t)?.value||"").trim();
 if(!name){alert("表示名を入力してください");return}
 const conflict=allClients().find(x=>x.name===name&&keyForName(x.name,reg)!==key);
 if(conflict){alert("同じ表示名のお客様がいます。別の表示名にしてください。");return}
 const aliases=uniq([...(old.aliases||[]),old.name,!String(key).startsWith("c_")?key:""]);
 reg[key]={...old,id:old.id||legacyId(key),name,aliases,goal,goalSet:true,updatedAt:new Date().toISOString()};
 writeRegistry(reg);syncMetaAliases();renderClientAdmin();refresh();
};
window.axisSetClientActiveToken=function(t,active){
 const key=untoken(t),reg=readRegistry(),old=reg[key]||normalizeRecord(key,{name:key,active:true}),name=old.name||key;
 if(!active&&!confirm(name+"さんを退会扱いにしますか？\n\nトレーニング履歴は削除されません。"))return;
 reg[key]={...old,id:old.id||legacyId(key),name,aliases:uniq([...(old.aliases||[]),name,!String(key).startsWith("c_")?key:""]),active:!!active,retiredAt:active?"":new Date().toISOString(),updatedAt:new Date().toISOString()};
 writeRegistry(reg);renderClientAdmin();refresh();
};
window.axisOpenClientToken=function(t){const key=untoken(t),reg=readRegistry(),name=reg[key]?.name||displayNameFor(key,reg);show("detail",false);openClient(name)};

// Keep callers using an old name working after rename.
if(typeof window.openClient==="function"){
 const f=window.openClient;window.openClient=function(name){return f(displayNameFor(name))}
}
if(typeof window.prefill==="function"){
 const f=window.prefill;window.prefill=function(name){return f(displayNameFor(name))}
}

// Complete portable backup. This is manual transfer, not automatic cloud sync.
function backupPayload(){
 return {
  format:"AXIS_TRAINING_BACKUP",version:2,exported:new Date().toISOString(),
  sessions:Array.isArray(added)?added:[],
  clients:readRegistry(),
  historyEdits:parseJSON(localStorage.getItem(EDIT_KEY)||"{}",{}),
  hiddenSchedule:parseJSON(localStorage.getItem(HIDE_KEY)||"[]",[]),
  draft:parseJSON(localStorage.getItem("axis_training_draft")||"null",null)
 };
}
window.axisBuildBackup=backupPayload;
window.exportBackup=function(){
 const data=backupPayload(),blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"}),a=document.createElement("a");
 a.href=URL.createObjectURL(blob);a.download="AXIS_complete_backup_"+new Date().toLocaleDateString("sv-SE").replaceAll("-","")+".json";a.click();
 setTimeout(()=>URL.revokeObjectURL(a.href),500);
};
function sessionSig(s){return JSON.stringify([s?.date||"",s?.client||"",s?.savedAt||"",s?.status||"",s?.exercises||[]])}
function mergeSessions(current,incoming){
 const out=[],seen=new Set();[...(current||[]),...(incoming||[])].forEach(s=>{const k=sessionSig(s);if(!seen.has(k)){seen.add(k);out.push(s)}});return out;
}
function mergeRegistry(current,incoming){
 const out={...current};
 Object.entries(incoming||{}).forEach(([k,v])=>{
   const inc=normalizeRecord(k,v),cur=out[k]?normalizeRecord(k,out[k]):null;
   if(!cur){out[k]=inc;return}
   const it=Date.parse(inc.updatedAt||inc.createdAt||0)||0,ct=Date.parse(cur.updatedAt||cur.createdAt||0)||0;
   out[k]=it>ct?inc:cur;
 });
 return out;
}
window.axisImportBackupData=function(data){
 if(!data||typeof data!=="object")throw new Error("バックアップ形式が正しくありません");
 const sessions=Array.isArray(data.sessions)?data.sessions:[];
 const clients=data.clients&&typeof data.clients==="object"&&!Array.isArray(data.clients)?data.clients:{};
 const edits=data.historyEdits&&typeof data.historyEdits==="object"?data.historyEdits:{};
 const hidden=Array.isArray(data.hiddenSchedule)?data.hiddenSchedule:[];
 added=mergeSessions(Array.isArray(added)?added:[],sessions);
 localStorage.setItem("axis_training_added",JSON.stringify(added));
 writeRegistry(mergeRegistry(readRegistry(),clients));
 const curEdits=parseJSON(localStorage.getItem(EDIT_KEY)||"{}",{});
 localStorage.setItem(EDIT_KEY,JSON.stringify({...edits,...curEdits}));
 const curHidden=parseJSON(localStorage.getItem(HIDE_KEY)||"[]",[]);
 localStorage.setItem(HIDE_KEY,JSON.stringify(uniq([...(curHidden||[]),...hidden])));
 if(!localStorage.getItem("axis_training_draft")&&data.draft)localStorage.setItem("axis_training_draft",JSON.stringify(data.draft));
 syncMetaAliases();if(typeof renderAll==="function")renderAll();refresh();
 return {sessions:added.length,clients:Object.keys(readRegistry()).length};
};
window.axisImportBackupPrompt=function(){
 const i=document.createElement("input");i.type="file";i.accept=".json,application/json";
 i.onchange=()=>{const f=i.files?.[0];if(!f)return;const rd=new FileReader();rd.onload=()=>{
   try{
    const data=JSON.parse(String(rd.result||""));
    if(!confirm("このバックアップを現在端末へ統合しますか？\n\n現在の記録は削除せず、バックアップ内容を追加・統合します。"))return;
    const r=axisImportBackupData(data);alert("復元しました。\n記録: "+r.sessions+"件 / 顧客管理: "+r.clients+"件");
   }catch(e){alert("バックアップを読み込めませんでした。")}
 };rd.readAsText(f)};i.click();
};

async function storageStatus(){
 try{
  if(!navigator.storage?.persisted)return "ブラウザ管理";
  return await navigator.storage.persisted()?"保存保護 有効":"保存保護 未確定";
 }catch(e){return "ブラウザ管理"}
}
async function requestPersistentStorage(){
 try{if(navigator.storage?.persist)await navigator.storage.persist()}catch(e){}
 const el=S("#axisStorageStatus");if(el)el.textContent=await storageStatus();
}
window.axisRequestPersistentStorage=requestPersistentStorage;

window.renderMore=function(){
 if(typeof baseRenderMore==="function")baseRenderMore();
 const root=S("#more");if(!root||root.querySelector(".axport-card"))return;
 const card=document.createElement("div");card.className="ax16-panel axport-card";
 card.innerHTML='<div class="ax16-head"><div class="ax16-h"><span class="ic">'+v16Icon("download")+'</span>端末引き継ぎ・バックアップ</div><span id="axisStorageStatus" class="ax16-mut">確認中</span></div>'+
  '<p>トレーニング記録・顧客管理・履歴編集・非表示予定をまとめて保存できます。別端末では同じJSONを読み込んで引き継げます。</p>'+
  '<div class="axport-actions"><button class="ax16-btn pri" onclick="exportBackup()">完全バックアップ</button><button class="ax16-btn soft" onclick="axisImportBackupPrompt()">バックアップを復元</button></div>'+
  '<div class="axport-note">現在は自動クラウド同期ではありません。復元は既存データを消さず統合します。</div>';
 root.appendChild(card);requestPersistentStorage();
};

// Add a compact body map to screenshot mode without restoring the large detail card.
window.openSummary=function(name){
 const c=displayNameFor(name);baseOpenSummary(c);
 const hist=sessions(c),rows=hist[0]?.rows||[],box=S("#summary .axu-muscle-summary");
 if(box&&!box.querySelector(".axu-mini-anatomy")){
   const mini=document.createElement("div");mini.className="axu-mini-anatomy";mini.innerHTML=muscleMap(rows,{chips:false});box.appendChild(mini);
 }
 const report=S("#summary .axu-report");if(report)report.classList.toggle("axu-many",rows.length>4);
};

ensureAdminView();
syncMetaAliases();
})();