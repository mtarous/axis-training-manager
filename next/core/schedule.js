/* 予定。Googleカレンダーの取り込み済みスナップショットと、data.enc の手入力予定を1つに並べる。
   AXIS上で非表示にした予定はこの端末にだけ覚える。 */

import { getMeta } from "./meta.js?v=20";
import * as store from "./store.js?v=20";

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

/* 予定の題名から利用者と種類を読み取る。
   pairLabel が入っている2人は、カレンダー上は1枠でも両方の予定として扱う。 */
function resolveClients(text){
  const label = String(text || "").trim();
  const clients = store.clients();
  const direct = clients.find(c => c.name && label.includes(c.name));
  if(direct) return { clientId: direct.id, clientIds: [direct.id] };

  const pair = clients.filter(c => c.pairLabel && label.includes(c.pairLabel));
  if(pair.length){
    const ids = [...new Set(pair.map(c => c.id))];
    return { clientId: ids[0] || "", clientIds: ids };
  }
  return { clientId: "", clientIds: [] };
}

function fromCalendar(){
  return (getMeta().calendarEvents || []).map(e => {
    const label = String(e.summary || "予定").trim();
    const match = resolveClients(label);
    let type = "予定";
    if(label.includes("パーソナル")) type = "パーソナル";
    else if(/ケア|整体|施術/.test(label)) type = "ケア";
    else if(label.includes("体験")) type = "体験";
    return {
      date: String(e.start || "").slice(0, 10),
      time: String(e.start || "").slice(11, 16),
      label, type, calendar: true,
      clientId: match.clientId, clientIds: match.clientIds
    };
  }).filter(x => x.date && x.time);
}

function fromMeta(){
  return (getMeta().schedule || []).map(s => {
    const label = String(s.label || s.client || "予定");
    const match = resolveClients(String(s.client || label));
    return {
      date: String(s.date || "").slice(0, 10),
      time: String(s.time || ""),
      label,
      type: String(s.type || "予定"),
      calendar: false,
      clientId: match.clientId, clientIds: match.clientIds
    };
  }).filter(x => x.date);
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
