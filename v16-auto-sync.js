/* AXIS automatic sync client
   Disabled by default. No network traffic occurs until the user configures
   a private Apps Script Web App URL + token and enables sync. */
(function(){
"use strict";

const CFG_KEY="axis_sync_config_v1";
const PASS_KEY="axis_sync_session_pass_v1";
const DEVICE_KEY="axis_sync_device_id_v1";
const HIST_TOMB_KEY="axis_sync_history_tombstones_v1";
const SCHED_STATE_KEY="axis_sync_schedule_state_v1";
const LAST_HASH_KEY="axis_sync_last_hash_v1";
const SCHEMA=1;
const PULL_LIMIT=20;
const AUTO_INTERVAL_MS=5*60*1000;
const SYNC_SALT="AXIS_SYNC_PRIVATE_KEY_V1";
const SYNC_AAD="AXIS_SYNC_PRIVATE_PAYLOAD_V1";
const S=s=>document.querySelector(s);

const baseRenderMore=window.renderMore;
const baseUnlock=window.unlock;
const baseBuildBackup=window.axisBuildBackup;
const baseImportBackup=window.axisImportBackupData;

function parseJSON(v,f){try{return JSON.parse(v)}catch(e){return f}}
function now(){return new Date().toISOString()}
function readCfg(){
  const x=parseJSON(localStorage.getItem(CFG_KEY)||"{}",{});
  return {
    enabled:!!x.enabled,
    url:String(x.url||""),
    token:String(x.token||""),
    lastSyncAt:String(x.lastSyncAt||""),
    lastRevision:Number(x.lastRevision||0),
    lastError:String(x.lastError||""),
    lastResult:String(x.lastResult||"")
  };
}
function writeCfg(p){localStorage.setItem(CFG_KEY,JSON.stringify({...readCfg(),...p}))}
function deviceId(){
  let x=localStorage.getItem(DEVICE_KEY);
  if(!x){x="AXDEV-"+Date.now().toString(36).toUpperCase()+"-"+Math.random().toString(36).slice(2,8).toUpperCase();localStorage.setItem(DEVICE_KEY,x)}
  return x;
}
function cleanUrl(v){return String(v||"").trim().replace(/[?#].*$/,"")}
function getPass(){return sessionStorage.getItem(PASS_KEY)||localStorage.getItem("axis_training_key")||""}
function bytesToB64(bytes){let s="";for(let i=0;i<bytes.length;i+=0x8000)s+=String.fromCharCode(...bytes.subarray(i,i+0x8000));return btoa(s)}
function b64ToBytes(s){return Uint8Array.from(atob(String(s||"")),c=>c.charCodeAt(0))}
function readMap(key){const x=parseJSON(localStorage.getItem(key)||"{}",{});return x&&typeof x==="object"&&!Array.isArray(x)?x:{}}
function writeMap(key,x){if(Object.keys(x).length)localStorage.setItem(key,JSON.stringify(x));else localStorage.removeItem(key)}
function isoMs(v){const n=Date.parse(v||0);return Number.isFinite(n)?n:0}
function later(a,b){return isoMs(a)>=isoMs(b)?a:b}
function sessionSig(s){return JSON.stringify([s?.date||"",s?.client||"",s?.savedAt||"",s?.status||"",s?.exercises||[]])}
function canonical(v){
  if(Array.isArray(v))return "["+v.map(canonical).join(",")+"]";
  if(v&&typeof v==="object")return "{"+Object.keys(v).sort().map(k=>JSON.stringify(k)+":"+canonical(v[k])).join(",")+"}";
  return JSON.stringify(v);
}
function normalizedState(p){
  const sessions=[...(p.sessions||[])].sort((a,b)=>sessionSig(a).localeCompare(sessionSig(b)));
  return {
    format:"AXIS_SYNC_PAYLOAD",version:1,
    sessions,
    clients:p.clients||{},
    historyEdits:p.historyEdits||{},
    hiddenSchedule:[...(p.hiddenSchedule||[])].map(String).sort(),
    syncMeta:{
      historyTombstones:p.syncMeta?.historyTombstones||{},
      scheduleState:p.syncMeta?.scheduleState||{}
    }
  };
}
async function sha256Text(s){
  const d=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(String(s)));
  return [...new Uint8Array(d)].map(x=>x.toString(16).padStart(2,"0")).join("");
}
async function deriveKey(pass){
  const te=new TextEncoder();
  const km=await crypto.subtle.importKey("raw",te.encode(pass),"PBKDF2",false,["deriveKey"]);
  return crypto.subtle.deriveKey(
    {name:"PBKDF2",salt:te.encode(SYNC_SALT),iterations:210000,hash:"SHA-256"},
    km,{name:"AES-GCM",length:256},false,["encrypt","decrypt"]
  );
}
async function compressBytes(bytes){
  if(typeof CompressionStream==="undefined")return {bytes,zip:"none"};
  const stream=new Blob([bytes]).stream().pipeThrough(new CompressionStream("gzip"));
  return {bytes:new Uint8Array(await new Response(stream).arrayBuffer()),zip:"gzip"};
}
async function decompressBytes(bytes,zip){
  if(zip!=="gzip")return bytes;
  if(typeof DecompressionStream==="undefined")throw new Error("このブラウザは同期データの展開に対応していません。");
  const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
async function encryptPayload(payload,pass){
  const state=normalizedState(payload);
  const checksum=await sha256Text(canonical(state));
  const raw=new TextEncoder().encode(JSON.stringify({...state,generatedAt:now()}));
  const packed=await compressBytes(raw);
  const iv=crypto.getRandomValues(new Uint8Array(12)),key=await deriveKey(pass);
  const ct=await crypto.subtle.encrypt({name:"AES-GCM",iv,additionalData:new TextEncoder().encode(SYNC_AAD)},key,packed.bytes);
  return {ct:bytesToB64(new Uint8Array(ct)),iv:bytesToB64(iv),zip:packed.zip,checksum};
}
async function decryptSnapshot(snap,pass){
  const key=await deriveKey(pass),iv=b64ToBytes(snap.iv),ct=b64ToBytes(snap.ct);
  const pt=await crypto.subtle.decrypt({name:"AES-GCM",iv,additionalData:new TextEncoder().encode(SYNC_AAD)},key,ct);
  const raw=await decompressBytes(new Uint8Array(pt),snap.zip||"none");
  const obj=JSON.parse(new TextDecoder().decode(raw));
  if(obj.format!=="AXIS_SYNC_PAYLOAD"||Number(obj.version)!==1)throw new Error("同期データ形式が違います。");
  const checksum=await sha256Text(canonical(normalizedState(obj)));
  if(snap.checksum&&checksum!==snap.checksum)throw new Error("同期データの整合性確認に失敗しました。");
  return obj;
}

function bootstrapScheduleState(){
  const st=readMap(SCHED_STATE_KEY),hidden=parseJSON(localStorage.getItem("axis_hidden_schedule_v1")||"[]",[]);
  for(const key of Array.isArray(hidden)?hidden:[])if(!st[key])st[key]={hidden:true,updatedAt:"1970-01-01T00:00:00.000Z"};
  writeMap(SCHED_STATE_KEY,st);return st;
}
function buildSyncPayload(){
  if(typeof baseBuildBackup!=="function")throw new Error("バックアップ機能を読み込めません。");
  const b=baseBuildBackup();
  return {
    format:"AXIS_SYNC_PAYLOAD",version:1,
    sessions:Array.isArray(b.sessions)?b.sessions:[],
    clients:b.clients&&typeof b.clients==="object"?b.clients:{},
    historyEdits:b.historyEdits&&typeof b.historyEdits==="object"?b.historyEdits:{},
    hiddenSchedule:Array.isArray(b.hiddenSchedule)?b.hiddenSchedule:[],
    syncMeta:{
      historyTombstones:readMap(HIST_TOMB_KEY),
      scheduleState:bootstrapScheduleState()
    }
  };
}
window.axisBuildSyncPayload=buildSyncPayload;

function mergeHistoryState(payloads){
  let edits=readMap("axis_training_edits_v1"),tombs=readMap(HIST_TOMB_KEY);
  const applyEdit=(k,e)=>{
    if(!e||typeof e!=="object")return;
    const tomb=tombs[k],et=isoMs(e.updatedAt),tt=isoMs(tomb?.updatedAt);
    const cur=edits[k],ct=isoMs(cur?.updatedAt);
    if(et>=ct&&et>tt){edits[k]=e;delete tombs[k]}
  };
  const applyTomb=(k,t)=>{
    if(!t||typeof t!=="object")return;
    const tt=isoMs(t.updatedAt),et=isoMs(edits[k]?.updatedAt),ct=isoMs(tombs[k]?.updatedAt);
    if(tt>=ct&&tt>=et){tombs[k]=t;delete edits[k]}
  };
  for(const p of payloads){
    Object.entries(p.historyEdits||{}).forEach(([k,e])=>applyEdit(k,e));
    Object.entries(p.syncMeta?.historyTombstones||{}).forEach(([k,t])=>applyTomb(k,t));
  }
  writeMap("axis_training_edits_v1",edits);writeMap(HIST_TOMB_KEY,tombs);
}
function mergeScheduleState(payloads){
  let state=bootstrapScheduleState();
  const apply=(k,v)=>{
    if(!v||typeof v!=="object")return;
    if(isoMs(v.updatedAt)>=isoMs(state[k]?.updatedAt))state[k]={hidden:!!v.hidden,updatedAt:String(v.updatedAt||"")};
  };
  for(const p of payloads){
    const rs=p.syncMeta?.scheduleState;
    if(rs&&typeof rs==="object")Object.entries(rs).forEach(([k,v])=>apply(k,v));
    else{
      const t=String(p.generatedAt||"1970-01-01T00:00:00.000Z");
      for(const k of (p.hiddenSchedule||[]))apply(String(k),{hidden:true,updatedAt:t});
    }
  }
  writeMap(SCHED_STATE_KEY,state);
  const hidden=Object.entries(state).filter(([,v])=>v.hidden).map(([k])=>k).sort();
  localStorage.setItem("axis_hidden_schedule_v1",JSON.stringify(hidden));
}
function mergeRemotePayloads(payloads){
  for(const p of payloads){
    if(typeof baseImportBackup==="function"){
      baseImportBackup({
        sessions:Array.isArray(p.sessions)?p.sessions:[],
        clients:p.clients&&typeof p.clients==="object"?p.clients:{},
        historyEdits:{},hiddenSchedule:[],draft:null
      });
    }
  }
  mergeHistoryState(payloads);mergeScheduleState(payloads);
  if(typeof renderAll==="function")renderAll();
}

function jsonp(action,cfg){
  return new Promise((resolve,reject)=>{
    const cb="__axisSyncCb_"+Date.now()+"_"+Math.random().toString(36).slice(2);
    const timer=setTimeout(()=>done(new Error("同期サーバーから応答がありません。")),15000);
    const sc=document.createElement("script");
    const done=(err,data)=>{clearTimeout(timer);delete window[cb];sc.remove();err?reject(err):resolve(data)};
    window[cb]=data=>done(null,data);
    const u=new URL(cfg.url);
    u.searchParams.set("action",action);u.searchParams.set("key",cfg.token);u.searchParams.set("callback",cb);
    if(action==="pull")u.searchParams.set("limit",String(PULL_LIMIT));
    sc.onerror=()=>done(new Error("同期サーバーへ接続できません。"));
    sc.src=u.toString();document.head.appendChild(sc);
  });
}
async function pushSnapshot(enc,cfg){
  await fetch(cfg.url,{
    method:"POST",mode:"no-cors",cache:"no-store",
    headers:{"Content-Type":"text/plain;charset=UTF-8"},
    body:JSON.stringify({action:"push",key:cfg.token,device_id:deviceId(),schema_version:SCHEMA,...enc})
  });
}
function syncStatus(text,type){
  const el=S("#axisSyncStatus");if(el){el.textContent=text;el.dataset.type=type||""}
}
function fmtSyncTime(v){
  if(!v)return "未同期";
  const d=new Date(v);if(Number.isNaN(+d))return "未同期";
  return d.toLocaleString("ja-JP",{month:"numeric",day:"numeric",hour:"2-digit",minute:"2-digit"});
}

let running=false,debounceTimer=null;
window.axisSyncNow=async function(opts={}){
  const silent=!!opts.silent,cfg=readCfg();
  if(!cfg.url||!cfg.token){if(!silent)alert("同期URLと同期キーを設定してください。");return {ok:false,reason:"not_configured"}}
  const pass=getPass();
  if(!pass){if(!silent)alert("一度AXISをロック解除してから同期してください。");return {ok:false,reason:"locked"}}
  if(running)return {ok:false,reason:"busy"};
  running=true;syncStatus("同期中…","busy");
  try{
    const pulled=await jsonp("pull",cfg);
    if(!pulled?.ok)throw new Error(pulled?.error||"同期データを取得できません。");
    const snaps=Array.isArray(pulled.snapshots)?pulled.snapshots:[];
    const payloads=[];
    for(const s of [...snaps].sort((a,b)=>(a.revision||0)-(b.revision||0))){
      try{payloads.push(await decryptSnapshot(s,pass))}
      catch(e){throw new Error("同期データを復号できません。アクセスコードが同じか確認してください。")}
    }
    if(payloads.length)mergeRemotePayloads(payloads);

    const local=buildSyncPayload(),enc=await encryptPayload(local,pass);
    const remoteHas=snaps.some(s=>String(s.checksum||"")===enc.checksum);
    let pushed=false;
    if(!remoteHas){
      await pushSnapshot(enc,cfg);pushed=true;
      // POST is intentionally no-cors for Apps Script. Confirm by pulling.
      await new Promise(r=>setTimeout(r,900));
      const confirm=await jsonp("pull",cfg);
      if(!confirm?.ok||!(confirm.snapshots||[]).some(s=>String(s.checksum||"")===enc.checksum)){
        throw new Error("同期データの保存確認ができませんでした。");
      }
      pulled.latestRevision=Math.max(Number(pulled.latestRevision||0),...(confirm.snapshots||[]).map(s=>Number(s.revision||0)));
    }
    const t=now();
    writeCfg({lastSyncAt:t,lastRevision:Number(pulled.latestRevision||0),lastError:"",lastResult:pushed?"統合して保存":"最新状態"});
    localStorage.setItem(LAST_HASH_KEY,enc.checksum);
    syncStatus((pushed?"同期完了":"最新です")+" ・ "+fmtSyncTime(t),"ok");
    if(!silent&&opts.notice!==false)alert(pushed?"同期しました。":"すでに最新です。");
    return {ok:true,pushed,pulled:payloads.length,checksum:enc.checksum};
  }catch(e){
    const msg=String(e?.message||e);writeCfg({lastError:msg});syncStatus("同期エラー","error");
    if(!silent)alert("同期できませんでした。\n"+msg);
    return {ok:false,error:msg};
  }finally{running=false}
};
function scheduleSync(){
  const cfg=readCfg();if(!cfg.enabled||!cfg.url||!cfg.token)return;
  clearTimeout(debounceTimer);debounceTimer=setTimeout(()=>axisSyncNow({silent:true}),1800);
}
window.axisScheduleSync=scheduleSync;

window.axisSaveSyncSettings=function(){
  const url=cleanUrl(S("#axisSyncUrl")?.value),token=String(S("#axisSyncToken")?.value||"").trim();
  if(url&&!/^https:\/\/script\.google\.com\/macros\/s\//.test(url)){alert("Apps Script WebアプリのURLを入力してください。");return}
  writeCfg({url,token,lastError:""});
  syncStatus(url&&token?"設定済み ・ 未テスト":"未設定","");
};
window.axisToggleAutoSync=function(on){
  const cfg=readCfg();
  if(on&&(!cfg.url||!cfg.token)){const el=S("#axisSyncEnabled");if(el)el.checked=false;alert("先に同期URLと同期キーを保存してください。");return}
  writeCfg({enabled:!!on});renderSyncPanelState();
  if(on)axisSyncNow({silent:true});
};
window.axisTestSync=async function(){
  axisSaveSyncSettings();const cfg=readCfg();if(!cfg.url||!cfg.token)return;
  syncStatus("接続確認中…","busy");
  try{const r=await jsonp("ping",cfg);if(!r?.ok)throw new Error(r?.error||"接続できません");syncStatus("接続OK","ok");alert("同期サーバーへ接続できました。")}
  catch(e){writeCfg({lastError:String(e?.message||e)});syncStatus("接続エラー","error");alert("接続できませんでした。\n"+String(e?.message||e))}
};
function renderSyncPanelState(){
  const cfg=readCfg(),en=S("#axisSyncEnabled"),u=S("#axisSyncUrl"),t=S("#axisSyncToken");
  if(en)en.checked=cfg.enabled;if(u&&document.activeElement!==u)u.value=cfg.url;if(t&&document.activeElement!==t)t.value=cfg.token;
  const label=cfg.lastError?"エラーあり":cfg.lastSyncAt?((cfg.lastResult||"同期済み")+" ・ "+fmtSyncTime(cfg.lastSyncAt)):(cfg.url&&cfg.token?"設定済み ・ 未同期":"未設定");
  syncStatus(label,cfg.lastError?"error":cfg.lastSyncAt?"ok":"");
}
function syncPanel(){
  const cfg=readCfg();
  return '<div class="ax16-panel axsync-card">'+
   '<div class="ax16-head"><div class="ax16-h"><span class="ic">↻</span>端末間自動同期</div><span id="axisSyncStatus" class="axsync-status"></span></div>'+
   '<p>個人Driveの非公開同期先へ、暗号化したデータだけを送ります。同期OFF中は通信しません。</p>'+
   '<label class="axsync-toggle"><span><b>自動同期</b><small>起動時・変更後・5分ごと</small></span><input id="axisSyncEnabled" type="checkbox" '+(cfg.enabled?"checked":"")+' onchange="axisToggleAutoSync(this.checked)"></label>'+
   '<label class="axsync-label">Apps Script WebアプリURL</label><input id="axisSyncUrl" class="axsync-input" value="'+esc(cfg.url)+'" placeholder="https://script.google.com/macros/s/.../exec">'+
   '<label class="axsync-label">同期キー</label><input id="axisSyncToken" class="axsync-input" type="password" value="'+esc(cfg.token)+'" placeholder="AXIS_SYNC_PRIVATE の config に表示">'+
   '<div class="axsync-actions"><button class="ax16-btn soft" onclick="axisSaveSyncSettings()">設定を保存</button><button class="ax16-btn soft" onclick="axisTestSync()">接続テスト</button><button class="ax16-btn pri" onclick="axisSyncNow({notice:true})">今すぐ同期</button></div>'+
   '<div class="axsync-meta">端末ID '+esc(deviceId())+' / 最新revision '+Number(cfg.lastRevision||0)+'</div>'+
  '</div>';
}
window.renderMore=function(){
  if(typeof baseRenderMore==="function")baseRenderMore();
  const root=S("#more");if(!root||root.querySelector(".axsync-card"))return;
  root.insertAdjacentHTML("afterbegin",syncPanel());renderSyncPanelState();
};

// Capture the access code only for the current browser session, then pull/merge if enabled.
if(typeof baseUnlock==="function"){
  window.unlock=async function(){
    const pass=String(S("#pass")?.value||"");
    const r=await baseUnlock();
    if(S("#app")&&getComputedStyle(S("#app")).display!=="none"){
      if(pass)sessionStorage.setItem(PASS_KEY,pass);
      const cfg=readCfg();if(cfg.enabled&&cfg.url&&cfg.token)setTimeout(()=>axisSyncNow({silent:true}),500);
    }
    return r;
  };
}

function wrapAfter(name,after){
  const f=window[name];if(typeof f!=="function")return;
  window[name]=function(...args){
    const r=f.apply(this,args);
    if(r&&typeof r.then==="function")return r.finally(()=>after(...args));
    after(...args);return r;
  };
}
function markHistoryTomb(key){
  if(!key)return;const x=readMap(HIST_TOMB_KEY);x[key]={deleted:true,updatedAt:now()};writeMap(HIST_TOMB_KEY,x);
}
function clearHistoryTomb(key){
  const x=readMap(HIST_TOMB_KEY);if(key&&x[key]){delete x[key];writeMap(HIST_TOMB_KEY,x)}
}
function setScheduleState(key,hidden){
  if(!key)return;const x=readMap(SCHED_STATE_KEY);x[key]={hidden:!!hidden,updatedAt:now()};writeMap(SCHED_STATE_KEY,x);
}

const hSave=window.axisSaveHistoryEdit;
if(typeof hSave==="function")window.axisSaveHistoryEdit=function(...a){
  const key=S("#axheKey")?.value,before=readMap("axis_training_edits_v1"),r=hSave.apply(this,a),after=readMap("axis_training_edits_v1");
  if(key&&after[key])clearHistoryTomb(key);
  else if(key&&before[key]&&!after[key])markHistoryTomb(key);
  if(JSON.stringify(before)!==JSON.stringify(after))scheduleSync();
  return r
};
const hDelete=window.axisDeleteHistoryRow;
if(typeof hDelete==="function")window.axisDeleteHistoryRow=function(key,...a){
  const before=readMap("axis_training_edits_v1"),r=hDelete.call(this,key,...a),after=readMap("axis_training_edits_v1");
  if(key&&after[key])clearHistoryTomb(key);
  if(JSON.stringify(before)!==JSON.stringify(after))scheduleSync();
  return r
};
const hRestore=window.axisRestoreHistoryEdit;
if(typeof hRestore==="function")window.axisRestoreHistoryEdit=function(key,...a){
  const before=readMap("axis_training_edits_v1"),r=hRestore.call(this,key,...a),after=readMap("axis_training_edits_v1");
  if(key&&before[key]&&!after[key]){markHistoryTomb(key);scheduleSync()}
  return r
};
const hReset=window.axisResetAllHistoryEdits;
if(typeof hReset==="function")window.axisResetAllHistoryEdits=function(...a){
  const before=readMap("axis_training_edits_v1"),r=hReset.apply(this,a),after=readMap("axis_training_edits_v1");
  let changed=false;for(const key of Object.keys(before))if(!after[key]){markHistoryTomb(key);changed=true}
  if(changed)scheduleSync();return r
};

function hiddenSet(){return new Set(parseJSON(localStorage.getItem("axis_hidden_schedule_v1")||"[]",[]))}
const sHide=window.hideScheduleItem;
if(typeof sHide==="function")window.hideScheduleItem=function(key,...a){
  const before=hiddenSet(),r=sHide.call(this,key,...a),after=hiddenSet();
  if(before.has(key)!==after.has(key)){setScheduleState(key,after.has(key));scheduleSync()}
  return r
};
const sRestore=window.restoreScheduleItem;
if(typeof sRestore==="function")window.restoreScheduleItem=function(key,...a){
  const before=hiddenSet(),r=sRestore.call(this,key,...a),after=hiddenSet();
  if(before.has(key)!==after.has(key)){setScheduleState(key,after.has(key));scheduleSync()}
  return r
};
const sRestoreAll=window.restoreAllScheduleItems;
if(typeof sRestoreAll==="function")window.restoreAllScheduleItems=function(...a){
  const before=hiddenSet(),r=sRestoreAll.apply(this,a),after=hiddenSet();let changed=false;
  for(const key of before)if(!after.has(key)){setScheduleState(key,false);changed=true}
  if(changed)scheduleSync();return r
};

["save","axisAddClient","axisSaveClientProfileToken","axisSetClientActiveToken"].forEach(n=>wrapAfter(n,()=>scheduleSync()));
const importBackup=window.axisImportBackupData;
if(typeof importBackup==="function")window.axisImportBackupData=function(...a){const r=importBackup.apply(this,a);scheduleSync();return r};

bootstrapScheduleState();
setInterval(()=>{const c=readCfg();if(c.enabled&&c.url&&c.token&&getPass())axisSyncNow({silent:true})},AUTO_INTERVAL_MS);
document.addEventListener("visibilitychange",()=>{
  if(document.visibilityState!=="visible")return;
  const c=readCfg();if(!c.enabled||!c.url||!c.token||!getPass())return;
  if(Date.now()-isoMs(c.lastSyncAt)>AUTO_INTERVAL_MS)axisSyncNow({silent:true});
});
})();