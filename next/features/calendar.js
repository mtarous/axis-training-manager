/* Googleカレンダーの直読み。
   Apps Script の op=calendar を JSONP で呼ぶ。
   設定していないとき・取れなかったときは、data.enc 同梱のスナップショットのまま動く。 */

import { getMeta, setMeta } from "../core/meta.js?v=20";

const KEY_SETTINGS = "axis_v2_calendar";
const KEY_CACHE    = "axis_v2_calendar_cache";
/* 予定を追加した直後にAXISへ反映しやすいよう、旧10分から1分へ短縮。 */
const FRESH_MS = 60 * 1000;

let inFlight = null;

export function settings(){
  try{
    let x = JSON.parse(localStorage.getItem(KEY_SETTINGS) || "{}") || {};
    // 旧版で接続済みの端末は、接続先と選択カレンダーを引き継ぐ。
    if(localStorage.getItem(KEY_SETTINGS) === null){
      const old = JSON.parse(localStorage.getItem("axis_sync_settings_v1") || "{}") || {};
      x = { endpoint: old.endpoint || "", token: old.token || "",
        calendarId: localStorage.getItem("axis_calendar_id_v1") || "" };
    }
    return {
      endpoint: String(x.endpoint || "").trim(),
      token: String(x.token || "").trim(),
      calendarId: String(x.calendarId || "").trim()
    };
  }catch(e){ return { endpoint:"", token:"", calendarId:"" } }
}
export function saveSettings(x){
  const cur = settings();
  const next = { ...cur, ...x };
  localStorage.setItem(KEY_SETTINGS, JSON.stringify(next));
  /* 接続先や対象カレンダーを変えたら、古い予定を新設定の予定として扱わない。 */
  if(cur.endpoint !== next.endpoint || cur.token !== next.token || cur.calendarId !== next.calendarId){
    clearCache();
  }
}
export function isConfigured(){
  const s = settings();
  return !!(s.endpoint && s.token);
}

function cache(){
  try{
    const x = JSON.parse(localStorage.getItem(KEY_CACHE) || "null");
    if(x && Array.isArray(x.events)) return x;
    /* 旧版が取得済みの予定を引き継ぐ。接続できない端末でも、前回の予定は見られる。 */
    const old = JSON.parse(localStorage.getItem("axis_calendar_live_v1") || "null");
    return old && Array.isArray(old.events) ? old : null;
  }catch(e){ return null }
}
function writeCache(x){
  try{ localStorage.setItem(KEY_CACHE, JSON.stringify(x)) }catch(e){}
}

/* Apps Script は CORS を返さないので、昔ながらの JSONP で読む。 */
function jsonp(endpoint, params, timeoutMs = 15000){
  return new Promise((resolve, reject) => {
    const cb = "axisCal" + Math.random().toString(36).slice(2);
    const script = document.createElement("script");
    let timer = 0;
    const done = (fn, v) => { clearTimeout(timer); delete window[cb]; script.remove(); fn(v) };
    window[cb] = v => done(resolve, v);
    script.onerror = () => done(reject, new Error("カレンダーに接続できませんでした"));
    timer = setTimeout(() => done(reject, new Error("カレンダーの取得が時間切れになりました")), timeoutMs);
    script.src = endpoint + "?" + new URLSearchParams({ ...params, callback: cb }).toString();
    document.head.appendChild(script);
  });
}

function apply(events, syncedAt){
  setMeta({ ...getMeta(), calendarEvents: events, calendarSyncedAt: syncedAt, calendarLive: true, calendarLoadError: "" });
}

/* 前回取れた分をすぐ出す。通信を待たせない。 */
export function applyCached(){
  const c = cache();
  if(c){ apply(c.events, c.syncedAt); return true }
  return false;
}

export async function refresh({ back = 14, days = 90 } = {}){
  const s = settings();
  if(!s.endpoint || !s.token) throw new Error("設定でカレンダーの接続先を入れてください。");
  if(inFlight) return inFlight;
  inFlight = (async () => {
    const params = { op: "calendar", token: s.token, back: String(back), days: String(days) };
    if(s.calendarId) params.calendarId = s.calendarId;
    const r = await jsonp(s.endpoint, params);
    if(!r || r.ok === false) throw new Error(String(r && r.error || "カレンダーを取得できませんでした"));
    const events = Array.isArray(r.events) ? r.events : [];
    const syncedAt = String(r.syncedAt || new Date().toISOString());
    writeCache({ events, syncedAt, at: Date.now() });
    apply(events, syncedAt);
    return { count: events.length, syncedAt };
  })();
  try{ return await inFlight } finally { inFlight = null }
}

/* 直近1分以内でなければ裏で取り直す。失敗しても元の予定は残す。 */
export async function refreshIfStale(){
  if(!isConfigured()) return;
  const c = cache();
  if(c && Date.now() - Number(c.at || 0) < FRESH_MS) return;
  try{ await refresh() }catch(e){ setMeta({ ...getMeta(), calendarLoadError: String(e.message || e) }) }
}

export async function listCalendars(){
  const s = settings();
  if(!s.endpoint || !s.token) throw new Error("設定でカレンダーの接続先を入れてください。");
  const r = await jsonp(s.endpoint, { op: "calendars", token: s.token });
  if(!r || r.ok === false) throw new Error(String(r && r.error || "カレンダー一覧を取得できませんでした"));
  return { list: Array.isArray(r.calendars) ? r.calendars : [], defaultId: String(r.defaultId || "") };
}

export function clearCache(){ localStorage.removeItem(KEY_CACHE) }
/* メールの設定リンクを、Safariとホーム画面のどちらでも受け取る。 */
export function importSetupLink(text){
  const match = String(text || "").match(/(?:[#&]|^)axissync=([A-Za-z0-9_-]+)/);
  if(!match) throw new Error("メールに届いたAXISの設定リンクを貼り付けてください。");
  let payload;
  try{
    const raw = match[1].replace(/-/g, "+").replace(/_/g, "/");
    const binary = atob(raw + "=".repeat((4 - raw.length % 4) % 4));
    payload = JSON.parse(new TextDecoder().decode(Uint8Array.from(binary, c => c.charCodeAt(0))));
  }catch(e){ throw new Error("設定リンクを読み取れませんでした。リンク全体をコピーしてください。") }
  const endpoint = String(payload.e || "").trim();
  const token = String(payload.t || "").trim();
  if(!/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(endpoint) || !token)
    throw new Error("設定リンクの接続先またはトークンが正しくありません。");
  saveSettings({ endpoint, token, calendarId: String(payload.c || "") });
  clearCache();
}
