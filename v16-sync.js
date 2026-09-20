/* AXIS v16 encrypted device sync
   - Browser-side AES-GCM only. Server stores opaque encrypted snapshots.
   - Endpoint/token are local device settings and are never committed with customer data.
   - Sync is OFF by default. */
(function(){
"use strict";

const SETTINGS_KEY="axis_sync_settings_v1";
const DEVICE_KEY="axis_sync_device_id_v1";
const REG_KEY="axis_client_registry_v1";
const EDIT_KEY="axis_training_edits_v1";
const HIDE_KEY="axis_hidden_schedule_v1";
const SCHED_STATE_KEY="axis_hidden_schedule_state_v2";
const SYNC_SCHEMA=1;
const KDF_ITER=210000;
const SYNC_AAD="AXIS_SYNC_PRIVATE|snapshot|v1";
const ZERO_TIME="1970-01-01T00:00:00.000Z";
let unlockedPassphrase="";
let syncInFlight=null;
let autoTimer=null;

const S=s=>document.querySelector(s);
function parseJSON(v,fallback){try{return JSON.parse(v)}catch(e){return fallback}}
function uniq(a){return [...new Set((a||[]).map(x=>String(x||"").trim()).filter(Boolean))]}
function stamp(v){const n=Date.parse(v||0);return Number.isFinite(n)?n:0}
function stableStringify(v){
  if(v===null||typeof v!=="object")return JSON.stringify(v);
  if(Array.isArray(v))return "["+v.map(stableStringify).join(",")+"]";
  return "{"+Object.keys(v).sort().map(k=>JSON.stringify(k)+":"+stableStringify(v[k])).join(",")+"}";
}
function bytesToB64(bytes){
  let s="";const a=bytes instanceof Uint8Array?bytes:new Uint8Array(bytes);
  for(let i=0;i<a.length;i+=0x8000)s+=String.fromCharCode(...a.subarray(i,i+0x8000));
  return btoa(s);
}
function b64ToBytes(s){return Uint8Array.from(atob(String(s||"")),c=>c.charCodeAt(0))}
async function sha256Text(s){
  const d=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(String(s||"")));
  return [...new Uint8Array(d)].map(x=>x.toString(16).padStart(2,"0")).join("");
}
function randomId(prefix){
  const b=crypto.getRandomValues(new Uint8Array(12));
  return prefix+bytesToB64(b).replace(/[+/=]/g,"").slice(0,18);
}
function deviceId(){
  let id=localStorage.getItem(DEVICE_KEY);
  if(!id){id=randomId("dev_");localStorage.setItem(DEVICE_KEY,id)}
  return id;
}
function readSettings(){
  const x=parseJSON(localStorage.getItem(SETTINGS_KEY)||"{}",{});
  return {
    enabled:x.enabled===true,
    endpoint:String(x.endpoint||""),
    token:String(x.token||""),
    lastSyncAt:String(x.lastSyncAt||""),
    lastError:String(x.lastError||""),
    lastRevision:Number(x.lastRevision)||0
  };
}
function writeSettings(next){
  const cur=readSettings(),v={...cur,...next};
  localStorage.setItem(SETTINGS_KEY,JSON.stringify(v));
  return v;
}
function normalizeEndpoint(v){
  const s=String(v||"").trim().replace(/\/+$/,"");
  if(!s)return "";
  if(!/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/(exec|dev)$/.test(s))throw new Error("Apps ScriptのWebアプリURL（/exec）を入力してください");
  return s;
}
function readHidden(){const x=parseJSON(localStorage.getItem(HIDE_KEY)||"[]",[]);return Array.isArray(x)?uniq(x):[]}
function readScheduleState(){
  const x=parseJSON(localStorage.getItem(SCHED_STATE_KEY)||"{}",{});
  return x&&typeof x==="object"&&!Array.isArray(x)?x:{};
}
function writeScheduleState(x){
  localStorage.setItem(SCHED_STATE_KEY,JSON.stringify(x||{}));
  const hidden=Object.entries(x||{}).filter(([,v])=>v&&v.hidden===true).map(([k])=>k);
  localStorage.setItem(HIDE_KEY,JSON.stringify(uniq(hidden)));
}
function migrateScheduleState(){
  const state=readScheduleState(),legacy=readHidden();
  let changed=false;
  legacy.forEach(k=>{if(!state[k]){state[k]={hidden:true,updatedAt:ZERO_TIME};changed=true}});
  if(changed)localStorage.setItem(SCHED_STATE_KEY,JSON.stringify(state));
  return state;
}
function setScheduleState(key,hidden,at){
  if(!key)return;
  const state=migrateScheduleState();
  state[key]={hidden:!!hidden,updatedAt:at||new Date().toISOString()};
  writeScheduleState(state);
}
function readRegistry(){const x=parseJSON(localStorage.getItem(REG_KEY)||"{}",{});return x&&typeof x==="object"&&!Array.isArray(x)?x:{}}
function readEdits(){const x=parseJSON(localStorage.getItem(EDIT_KEY)||"{}",{});return x&&typeof x==="object"&&!Array.isArray(x)?x:{}}

function sessionSig(s){return stableStringify([s?.date||"",s?.client||"",s?.savedAt||"",s?.status||"",s?.rpe??"",s?.pain??"",s?.note||"",s?.next||"",s?.exercises||[]])}
function mergeSessions(a,b){
  const out=[],seen=new Set();
  [...(a||[]),...(b||[])].forEach(s=>{const k=sessionSig(s);if(!seen.has(k)){seen.add(k);out.push(s)}});
  return out;
}
function deterministicWinner(a,b){
  const at=stamp(a?.updatedAt||a?.createdAt),bt=stamp(b?.updatedAt||b?.createdAt);
  if(at!==bt)return bt>at?b:a;
  return stableStringify(b)>stableStringify(a)?b:a;
}
function mergeClients(a,b){
  const out={...(a||{})};
  Object.entries(b||{}).forEach(([k,inc])=>{
    const cur=out[k];
    if(!cur){out[k]=inc;return}
    const win=deterministicWinner(cur,inc);
    const aliases=uniq([...(cur?.aliases||[]),...(inc?.aliases||[])]);
    out[k]={...win,aliases};
  });
  return out;
}
function mergeVersionedMap(a,b){
  const out={...(a||{})};
  Object.entries(b||{}).forEach(([k,inc])=>{
    if(!out[k])out[k]=inc;
    else out[k]=deterministicWinner(out[k],inc);
  });
  return out;
}
function legacyScheduleState(keys){
  const out={};(keys||[]).forEach(k=>{out[k]={hidden:true,updatedAt:ZERO_TIME}});return out;
}
function normalizeSyncData(data){
  data=data&&typeof data==="object"?data:{};
  const state=data.hiddenScheduleState&&typeof data.hiddenScheduleState==="object"&&!Array.isArray(data.hiddenScheduleState)
    ?data.hiddenScheduleState:legacyScheduleState(data.hiddenSchedule);
  return {
    sessions:Array.isArray(data.sessions)?data.sessions:[],
    clients:data.clients&&typeof data.clients==="object"&&!Array.isArray(data.clients)?data.clients:{},
    historyEdits:data.historyEdits&&typeof data.historyEdits==="object"&&!Array.isArray(data.historyEdits)?data.historyEdits:{},
    hiddenScheduleState:state
  };
}
function localSyncData(){
  const base=typeof window.axisBuildBackup==="function"?window.axisBuildBackup():{};
  return normalizeSyncData({
    sessions:Array.isArray(base.sessions)?base.sessions:(Array.isArray(added)?added:[]),
    clients:base.clients||readRegistry(),
    historyEdits:base.historyEdits||readEdits(),
    hiddenScheduleState:base.hiddenScheduleState||migrateScheduleState(),
    hiddenSchedule:base.hiddenSchedule||readHidden()
  });
}
function mergeData(a,b){
  const x=normalizeSyncData(a),y=normalizeSyncData(b);
  return {
    sessions:mergeSessions(x.sessions,y.sessions),
    clients:mergeClients(x.clients,y.clients),
    historyEdits:mergeVersionedMap(x.historyEdits,y.historyEdits),
    hiddenScheduleState:mergeVersionedMap(x.hiddenScheduleState,y.hiddenScheduleState)
  };
}
function applySyncData(data){
  const x=normalizeSyncData(data);
  added=x.sessions;
  localStorage.setItem("axis_training_added",JSON.stringify(added));
  localStorage.setItem(REG_KEY,JSON.stringify(x.clients));
  localStorage.setItem(EDIT_KEY,JSON.stringify(x.historyEdits));
  writeScheduleState(x.hiddenScheduleState);
  if(typeof renderAll==="function")renderAll();
  if(typeof window.renderClientAdmin==="function"&&S("#clientAdmin")?.classList.contains("on"))renderClientAdmin();
}

async function deriveKey(pass,salt,usage){
  const raw=await crypto.subtle.importKey("raw",new TextEncoder().encode(pass),"PBKDF2",false,["deriveKey"]);
  return crypto.subtle.deriveKey({name:"PBKDF2",salt,iterations:KDF_ITER,hash:"SHA-256"},raw,{name:"AES-GCM",length:256},false,usage);
}
async function encryptSnapshot(snapshot,pass){
  const salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12));
  const key=await deriveKey(pass,salt,["encrypt"]);
  const plaintext=new TextEncoder().encode(stableStringify(snapshot));
  const ct=await crypto.subtle.encrypt({name:"AES-GCM",iv,additionalData:new TextEncoder().encode(SYNC_AAD)},key,plaintext);
  const payload=JSON.stringify({v:1,kdf:"PBKDF2-SHA256",iter:KDF_ITER,salt_b64:bytesToB64(salt),ct_b64:bytesToB64(new Uint8Array(ct))});
  const ivB64=bytesToB64(iv),checksum=await sha256Text(payload+"|"+ivB64);
  return {payload,ivB64,checksum};
}
async function decryptSnapshot(row,pass){
  const payload=String(row?.payload_ciphertext||""),ivB64=String(row?.iv_b64||"");
  if(!payload||!ivB64)throw new Error("同期データが不完全です");
  const actual=await sha256Text(payload+"|"+ivB64);
  if(row.checksum&&String(row.checksum)!==actual)throw new Error("同期データの整合性確認に失敗しました");
  const env=parseJSON(payload,null);
  if(!env||env.v!==1||!env.salt_b64||!env.ct_b64)throw new Error("同期暗号形式が不正です");
  const salt=b64ToBytes(env.salt_b64),iv=b64ToBytes(ivB64);
  const raw=await crypto.subtle.importKey("raw",new TextEncoder().encode(pass),"PBKDF2",false,["deriveKey"]);
  const key=await crypto.subtle.deriveKey({name:"PBKDF2",salt,iterations:Number(env.iter)||KDF_ITER,hash:"SHA-256"},raw,{name:"AES-GCM",length:256},false,["decrypt"]);
  const pt=await crypto.subtle.decrypt({name:"AES-GCM",iv,additionalData:new TextEncoder().encode(SYNC_AAD)},key,b64ToBytes(env.ct_b64));
  const snap=JSON.parse(new TextDecoder().decode(pt));
  if(snap?.format!=="AXIS_SYNC_SNAPSHOT"||Number(snap.schemaVersion)!==SYNC_SCHEMA)throw new Error("同期スナップショット形式が不正です");
  return snap;
}
function getPassphrase(){
  return unlockedPassphrase||String(localStorage.getItem("axis_training_key")||"");
}
function endpointSettings(requireEnabled){
  const s=readSettings();
  if(requireEnabled&&!s.enabled)throw new Error("自動同期がOFFです");
  const endpoint=normalizeEndpoint(s.endpoint);
  if(!endpoint||!s.token)throw new Error("同期先URLと同期トークンを設定してください");
  return {...s,endpoint};
}
function jsonpRequest(endpoint,params,timeoutMs=15000){
  return new Promise((resolve,reject)=>{
    const cb="axisSyncCb_"+Date.now()+"_"+Math.random().toString(36).slice(2);
    const script=document.createElement("script");
    const done=()=>{try{delete window[cb]}catch(e){window[cb]=undefined}script.remove()};
    const timer=setTimeout(()=>{done();reject(new Error("同期先から応答がありません"))},timeoutMs);
    window[cb]=data=>{clearTimeout(timer);done();if(!data?.ok)reject(new Error(data?.error||"同期先エラー"));else resolve(data)};
    const q=new URLSearchParams({...params,callback:cb});
    script.onerror=()=>{clearTimeout(timer);done();reject(new Error("同期先へ接続できません"))};
    script.src=endpoint+"?"+q.toString();
    document.head.appendChild(script);
  });
}
async function pullRemote(s){
  const r=await jsonpRequest(s.endpoint,{op:"pull",token:s.token});
  return Array.isArray(r.snapshots)?r.snapshots:[];
}
async function healthRemote(s){
  return jsonpRequest(s.endpoint,{op:"health",token:s.token});
}
async function pushRemote(s,enc){
  const body=new URLSearchParams({
    op:"push",token:s.token,device_id:deviceId(),
    payload_ciphertext:enc.payload,iv_b64:enc.ivB64,checksum:enc.checksum,
    schema_version:String(SYNC_SCHEMA)
  });
  await fetch(s.endpoint,{method:"POST",mode:"no-cors",headers:{"Content-Type":"application/x-www-form-urlencoded;charset=UTF-8"},body});
}
async function confirmPush(s,checksum){
  for(let i=0;i<5;i++){
    if(i)await new Promise(r=>setTimeout(r,500+i*250));
    const rows=await pullRemote(s);
    const hit=rows.find(x=>String(x.checksum||"")===checksum);
    if(hit)return hit;
  }
  throw new Error("同期先への保存確認が取れませんでした");
}
function snapshotFor(data){
  return {format:"AXIS_SYNC_SNAPSHOT",schemaVersion:SYNC_SCHEMA,createdAt:new Date().toISOString(),deviceId:deviceId(),data:normalizeSyncData(data)};
}
function setStatus(errorText){
  const s=writeSettings({lastError:String(errorText||"")});
  renderSyncStatus(s);
}
function statusText(s){
  if(s.lastError)return "エラー";
  if(syncInFlight)return "同期中";
  if(s.lastSyncAt)return "同期済み";
  return s.enabled?"未同期":"OFF";
}
function formatLocalDate(v){
  if(!v)return "未実行";
  const d=new Date(v);return Number.isNaN(d.getTime())?"未実行":d.toLocaleString("ja-JP");
}
function renderSyncStatus(s=readSettings()){
  const st=S("#axisSyncStatus"),last=S("#axisSyncLast"),err=S("#axisSyncError"),toggle=S("#axisSyncEnabled");
  if(st)st.textContent=statusText(s);
  if(last)last.textContent=formatLocalDate(s.lastSyncAt);
  if(err){err.textContent=s.lastError||"";err.hidden=!s.lastError}
  if(toggle)toggle.checked=s.enabled===true;
}
async function syncNow(options={}){
  const force=options.force===true,silent=options.silent===true;
  if(syncInFlight)return syncInFlight;
  syncInFlight=(async()=>{
    renderSyncStatus();
    const s=endpointSettings(!force);
    const pass=getPassphrase();
    if(!pass)throw new Error("AXISをアクセスコードで開いてから同期してください");
    migrateScheduleState();

    const remote=await pullRemote(s);
    let merged=localSyncData(),latest=null,latestRevision=0;
    const sorted=[...remote].sort((a,b)=>(Number(a.revision)||0)-(Number(b.revision)||0));
    for(const row of sorted){
      const snap=await decryptSnapshot(row,pass);
      merged=mergeData(merged,snap.data);
      if((Number(row.revision)||0)>=latestRevision){latest=snap.data;latestRevision=Number(row.revision)||0}
    }

    applySyncData(merged);
    const mergedHash=await sha256Text(stableStringify(normalizeSyncData(merged)));
    const latestHash=latest?await sha256Text(stableStringify(normalizeSyncData(latest))):"";
    let revision=latestRevision;
    if(!latest||mergedHash!==latestHash){
      const enc=await encryptSnapshot(snapshotFor(merged),pass);
      await pushRemote(s,enc);
      const confirmed=await confirmPush(s,enc.checksum);
      revision=Number(confirmed.revision)||revision;
    }
    const next=writeSettings({lastSyncAt:new Date().toISOString(),lastError:"",lastRevision:revision});
    renderSyncStatus(next);
    return {revision,snapshots:remote.length,pushed:!latest||mergedHash!==latestHash};
  })().catch(e=>{
    const msg=e?.message||String(e);
    writeSettings({lastError:msg});renderSyncStatus();
    if(!silent)throw e;
    return {error:msg};
  }).finally(()=>{syncInFlight=null;renderSyncStatus()});
  return syncInFlight;
}
function queueAutoSync(){
  clearTimeout(autoTimer);
  const s=readSettings();if(!s.enabled)return;
  autoTimer=setTimeout(()=>syncNow({silent:true}).catch(()=>{}),1200);
}
function wrapMutation(name){
  const fn=window[name];if(typeof fn!=="function"||fn.__axisSyncWrapped)return;
  const wrapped=function(){const r=fn.apply(this,arguments);Promise.resolve(r).finally(queueAutoSync);return r};
  wrapped.__axisSyncWrapped=true;window[name]=wrapped;
}
function wrapScheduleMutations(){
  const hide=window.hideScheduleItem,restore=window.restoreScheduleItem,restoreAll=window.restoreAllScheduleItems;
  if(typeof hide==="function"&&!hide.__axisSyncWrapped){
    const w=function(key,label){
      const before=new Set(readHidden()),r=hide.apply(this,arguments),after=new Set(readHidden());
      if(!before.has(key)&&after.has(key)){setScheduleState(key,true);queueAutoSync()}
      return r;
    };w.__axisSyncWrapped=true;window.hideScheduleItem=w;
  }
  if(typeof restore==="function"&&!restore.__axisSyncWrapped){
    const w=function(key){
      const before=new Set(readHidden()),r=restore.apply(this,arguments),after=new Set(readHidden());
      if(before.has(key)&&!after.has(key)){setScheduleState(key,false);queueAutoSync()}
      return r;
    };w.__axisSyncWrapped=true;window.restoreScheduleItem=w;
  }
  if(typeof restoreAll==="function"&&!restoreAll.__axisSyncWrapped){
    const w=function(){
      const before=readHidden(),r=restoreAll.apply(this,arguments);
      const now=new Date().toISOString(),state=migrateScheduleState();
      before.forEach(k=>state[k]={hidden:false,updatedAt:now});
      writeScheduleState(state);queueAutoSync();return r;
    };w.__axisSyncWrapped=true;window.restoreAllScheduleItems=w;
  }
}
function installMutationHooks(){
  ["save","axisAddClient","axisSaveClientProfileToken","axisSetClientActiveToken","axisSaveHistoryEdit",
   "axisDeleteHistoryRow","axisRestoreHistoryEdit","axisResetAllHistoryEdits","axisImportBackupData"].forEach(wrapMutation);
  wrapScheduleMutations();
}
function syncCardHtml(s){
  return '<div class="ax16-panel axsync-card">'+
    '<div class="ax16-head"><div class="ax16-h"><span class="ic">↻</span>端末間の自動同期</div><span id="axisSyncStatus" class="axsync-state">'+statusText(s)+'</span></div>'+
    '<div class="axsync-row"><label class="axsync-toggle"><input id="axisSyncEnabled" type="checkbox" '+(s.enabled?"checked":"")+' onchange="axisSyncToggle(this.checked)"><span>自動同期</span></label><button class="ax16-btn pri" onclick="axisSyncNowButton()">今すぐ同期</button></div>'+
    '<div class="axsync-meta"><span>最終同期</span><b id="axisSyncLast">'+formatLocalDate(s.lastSyncAt)+'</b></div>'+
    '<div id="axisSyncError" class="axsync-error" '+(s.lastError?"":"hidden")+'>'+esc(s.lastError||"")+'</div>'+
    '<details class="axsync-settings"><summary>同期先設定</summary><div class="axsync-fields">'+
      '<label>Apps Script WebアプリURL<input id="axisSyncEndpoint" type="url" value="'+esc(s.endpoint)+'" placeholder="https://script.google.com/macros/s/.../exec"></label>'+
      '<label>同期トークン<input id="axisSyncToken" type="password" value="'+esc(s.token)+'" autocomplete="off" placeholder="axisSetupで表示されたトークン"></label>'+
      '<div class="axsync-actions"><button class="ax16-btn soft" onclick="axisSyncSaveSettings()">設定を保存・接続確認</button></div>'+
    '</div></details>'+
    '<p class="axsync-note">顧客情報はブラウザでAES-GCM暗号化してから送信します。URL・トークンはこの端末だけに保存されます。</p>'+
  '</div>';
}
const baseRenderMore=window.renderMore;
window.renderMore=function(){
  if(typeof baseRenderMore==="function")baseRenderMore();
  const root=S("#more");if(!root||root.querySelector(".axsync-card"))return;
  root.appendChild(document.createRange().createContextualFragment(syncCardHtml(readSettings())));
  renderSyncStatus();
};
window.axisSyncToggle=async function(on){
  try{
    if(on){
      const s=endpointSettings(false);
      writeSettings({enabled:true,endpoint:s.endpoint});
      renderSyncStatus();
      await syncNow({force:true});
    }else{writeSettings({enabled:false,lastError:""});renderSyncStatus()}
  }catch(e){
    writeSettings({enabled:false,lastError:e?.message||String(e)});renderSyncStatus();
    const d=S(".axsync-settings");if(d)d.open=true;
  }
};
window.axisSyncSaveSettings=async function(){
  try{
    const endpoint=normalizeEndpoint(S("#axisSyncEndpoint")?.value||""),token=String(S("#axisSyncToken")?.value||"").trim();
    if(!endpoint||!token)throw new Error("URLと同期トークンを入力してください");
    writeSettings({endpoint,token,lastError:""});
    const s=endpointSettings(false),r=await healthRemote(s);
    writeSettings({lastError:""});renderSyncStatus();
    alert("同期先へ接続できました。保存済みスナップショット: "+(Number(r.snapshotCount)||0)+"件");
  }catch(e){setStatus(e?.message||String(e))}
};
window.axisSyncNowButton=async function(){
  try{await syncNow({force:true});alert("同期が完了しました")}catch(e){alert("同期できませんでした。\n"+(e?.message||String(e)))}
};
window.axisSyncNow=function(){return syncNow({force:true})};
window.axisSetUnlockedPassphrase=function(pass){unlockedPassphrase=String(pass||"")};
window.axisAfterUnlock=function(){
  installMutationHooks();migrateScheduleState();
  const s=readSettings();
  if(s.enabled)setTimeout(()=>syncNow({silent:true}).catch(()=>{}),700);
};
window.addEventListener("online",()=>queueAutoSync());
document.addEventListener("visibilitychange",()=>{
  if(document.visibilityState==="visible"){
    const s=readSettings(),age=Date.now()-stamp(s.lastSyncAt);
    if(s.enabled&&age>120000)queueAutoSync();
  }
});
installMutationHooks();
migrateScheduleState();
if(window.__AXIS_SYNC_TEST__)window.axisSyncTestApi={mergeData,mergeSessions,mergeClients,mergeVersionedMap,normalizeSyncData,legacyScheduleState,stableStringify};

})();