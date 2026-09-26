/* AXIS v22 同期設定の受け取り
   #axissync=<base64url> のリンクを開くと、同期先URLとトークンを端末へ保存する。
   43文字のトークンを手入力しなくて済むようにするための受け口。
   値はURLのフラグメント（#以降）にあるためサーバーへは送られない。読み込み後すぐ消す。 */
(function(){
"use strict";

const SETTINGS_KEY="axis_sync_settings_v1";
const CAL_KEY="axis_calendar_id_v1";

function b64urlDecode(s){
  const t=String(s||"").replace(/-/g,"+").replace(/_/g,"/");
  const pad=t.length%4?"=".repeat(4-t.length%4):"";
  const bin=atob(t+pad);
  const bytes=Uint8Array.from(bin,c=>c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}
function readSettings(){
  try{return JSON.parse(localStorage.getItem(SETTINGS_KEY)||"{}")||{}}catch(e){return {}}
}
function applyPayload(raw){
  let p;
  try{ p=JSON.parse(b64urlDecode(raw)) }catch(e){ return {ok:false,error:"リンクの内容を読み取れませんでした"} }
  const endpoint=String(p.e||"").trim(), token=String(p.t||"").trim();
  if(!/^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec$/.test(endpoint))
    return {ok:false,error:"同期先URLの形式が正しくありません"};
  if(!token) return {ok:false,error:"トークンが入っていません"};
  const cur=readSettings();
  localStorage.setItem(SETTINGS_KEY,JSON.stringify({...cur,endpoint,token,lastError:""}));
  if(p.c) localStorage.setItem(CAL_KEY,String(p.c));
  return {ok:true,endpoint};
}

/* 貼り付けられた文字列から設定を取り込む。
   ホーム画面に追加したアプリはSafariと保存領域が別なので、
   リンクをタップする代わりに、リンクそのものを貼り付けて設定できるようにする。 */
window.axisApplySetupText=function(text){
  const m=String(text||"").match(/axissync=([A-Za-z0-9_\-]+)/);
  const raw=m?m[1]:String(text||"").trim();
  if(!raw) return {ok:false,error:"設定リンクが空です"};
  return applyPayload(raw);
};

/* 「その他」の同期カードに貼り付け欄を出す */
function injectPasteBox(){
  if(document.querySelector("#axisSetupPaste")) return;
  const card=document.querySelector(".axsync-card");
  if(!card) return;
  const mk=(t,c,x)=>{const e=document.createElement(t);if(c)e.className=c;if(x!=null)e.textContent=x;return e};
  const wrap=mk("div","axsetup-paste"); wrap.id="axisSetupPaste";
  wrap.appendChild(mk("div","axsetup-title","設定リンクを貼り付けて設定"));
  wrap.appendChild(mk("div","axsetup-help","メールの「AXIS TRAINING 同期設定リンク」を長押しして『リンクをコピー』し、ここに貼り付けてください。ホーム画面に追加したアプリでも、この方法なら設定できます。"));
  const ta=document.createElement("textarea");
  ta.className="axsetup-input"; ta.placeholder="ここに設定リンクを貼り付け"; ta.rows=2; ta.spellcheck=false;
  wrap.appendChild(ta);
  const btn=mk("button","ax16-btn pri axsetup-btn","この内容で設定する"); btn.type="button";
  wrap.appendChild(btn);
  const out=mk("div","axsetup-out"); wrap.appendChild(out);
  btn.onclick=()=>{
    const r=window.axisApplySetupText(ta.value);
    if(r.ok){
      out.className="axsetup-out ok";
      out.textContent="設定しました。下の「今すぐ同期」を押してください。";
      ta.value="";
      if(typeof renderMore==="function") setTimeout(renderMore,400);
    }else{
      out.className="axsetup-out ng";
      out.textContent=r.error||"設定できませんでした";
    }
  };
  card.appendChild(wrap);
}
window.axisInjectSetupPaste=injectPasteBox;
document.addEventListener("click",()=>setTimeout(injectPasteBox,80));
setTimeout(injectPasteBox,1200);

function consume(){
  const h=String(location.hash||"");
  const m=h.match(/[#&]axissync=([A-Za-z0-9_\-]+)/);
  if(!m) return;
  const r=applyPayload(m[1]);
  /* 履歴や画面にトークンを残さない */
  try{ history.replaceState(null,"",location.pathname+location.search) }catch(e){ location.hash="" }
  setTimeout(()=>{
    if(r.ok){
      alert("同期先を設定しました。\n\nその他 → 端末間の自動同期 で「今すぐ同期」を押してください。");
      if(typeof renderAll==="function") renderAll();
    }else{
      alert("同期先を設定できませんでした。\n"+r.error);
    }
  },600);
}

if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",consume);
else consume();
window.addEventListener("hashchange",consume);
})();
