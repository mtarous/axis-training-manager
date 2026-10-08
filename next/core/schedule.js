/* 予定。Googleカレンダーの取り込み済みスナップショットと、data.enc の手入力予定を1つに並べる。
   AXIS上で非表示にした予定はこの端末にだけ覚える。 */

import { getMeta } from "./meta.js?v=14";
import * as store from "./store.js?v=14";

const HIDE_KEY = "axis_v2_hidden_schedule";

function readHidden(){
  try{ const a = JSON.parse(localStorage.getItem(HIDE_KEY) || "[]"); return Array.isArray(a) ? a : [] }
  catch(e){ return [] }
}
function writeHidden(a){
  if(a.length) localStorage.setItem(HIDE_KEY, JSON.stringify(a));
  else localStorage.removeItem(HIDE_KEY);
}
export function keyOf(item){ return [item.date, item.time, item.label].join("|") }

export function hide(key){
  const a = readHidden();
  if(!a.includes(key)){ a.push(key); writeHidden(a) }
}
export function restore(key){ writeHidden(readHidden().filter(x => x !== key)) }
export function restoreAll(){ writeHidden([]) }
export function hiddenCount(){ return readHidden().length }

/* 予定の題名から利用者と種類を読み取る */
function fromCalendar(){
  const names = store.clients().map(c => c.name);
  return (getMeta().calendarEvents || []).map(e => {
    const label = String(e.summary || "予定").trim();
    const hit = names.find(n => n && label.includes(n)) || "";
    let type = "予定";
    if(label.includes("パーソナル")) type = "パーソナル";
    else if(/ケア|整体|施術/.test(label)) type = "ケア";
    else if(label.includes("体験")) type = "体験";
    return {
      date: String(e.start || "").slice(0, 10),
      time: String(e.start || "").slice(11, 16),
      label, type, calendar: true,
      clientId: hit ? (store.clientByName(hit)?.id || "") : ""
    };
  }).filter(x => x.date && x.time);
}

function fromMeta(){
  return (getMeta().schedule || []).map(s => ({
    date: String(s.date || "").slice(0, 10),
    time: String(s.time || ""),
    label: String(s.label || s.client || "予定"),
    type: String(s.type || "予定"),
    calendar: false,
    clientId: s.client ? (store.clientByName(s.client)?.id || "") : ""
  })).filter(x => x.date);
}

export function all({ includeHidden = false } = {}){
  const hidden = new Set(readHidden());
  const seen = new Set();
  return [...fromCalendar(), ...fromMeta()]
    .filter(x => {
      const k = keyOf(x);
      if(seen.has(k)) return false;
      seen.add(k);
      return includeHidden || !hidden.has(k);
    })
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
}

export function hiddenItems(){
  const hidden = new Set(readHidden());
  return all({ includeHidden: true }).filter(x => hidden.has(keyOf(x)));
}

export function syncedAt(){ return String(getMeta().calendarSyncedAt || "") }
