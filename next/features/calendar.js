/* Googleカレンダーの直読み。
   Apps Script の op=calendar を JSONP で呼ぶ。
   設定していないとき・取れなかったときは、data.enc 同梱のスナップショットのまま動く。 */

import { getMeta, setMeta } from "../core/meta.js";

const KEY_SETTINGS = "axis_v2_calendar";
const KEY_CACHE    = "axis_v2_calendar_cache";
const FRESH_MS = 10 * 60 * 1000;

let inFlight = null;

export function settings(){
  try{
    const x = JSON.parse(localStorage.getItem(KEY_SETTINGS) || "{}") || {};
    return {
      endpoint: String(x.endpoint || "").trim(),
      token: String(x.token || "").trim(),
      calendarId: String(x.calendarId || "").trim()
    };
  }catch(e){ return { endpoint:"", token:"", calendarId:"" } }
}
export function saveSettings(x){
  const cur = settings();
  localStorage.setItem(KEY_SETTINGS, JSON.stringify({ ...cur, ...x }));
}
export function isConfigured(){
  const s = settings();
  return !!(s.endpoint && s.token);
}

function cache(){
  try{
    const x = JSON.parse(localStorage.getItem(KEY_CACHE) || "null");
    return x && Array.isArray(x.events) ? x : null;
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
  setMeta({ ...getMeta(), calendarEvents: events, calendarSyncedAt: syncedAt, calendarLive: true });
}

/* 前回取れた分をすぐ出す。通信を待たせない。 */
export function applyCached(){
  const c = cache();
  if(c && c.events.length){ apply(c.events, c.syncedAt); return true }
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

/* 取ってから時間が経っていれば裏で取り直す。失敗しても黙って元のまま。 */
export async function refreshIfStale(){
  if(!isConfigured()) return;
  const c = cache();
  if(c && Date.now() - Number(c.at || 0) < FRESH_MS) return;
  try{ await refresh() }catch(e){}
}

export async function listCalendars(){
  const s = settings();
  if(!s.endpoint || !s.token) throw new Error("設定でカレンダーの接続先を入れてください。");
  const r = await jsonp(s.endpoint, { op: "calendars", token: s.token });
  if(!r || r.ok === false) throw new Error(String(r && r.error || "カレンダー一覧を取得できませんでした"));
  return { list: Array.isArray(r.calendars) ? r.calendars : [], defaultId: String(r.defaultId || "") };
}

export function clearCache(){ localStorage.removeItem(KEY_CACHE) }
