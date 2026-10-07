/* AXIS v2 データの置き場。
   状態を変える道はここだけ。画面は読むだけで、直接 localStorage に触らない。 */

import { newId, normalizeSession, nowISO, today } from "./model.js";

const KEY_STATE = "axis_v2_state";
const KEY_DRAFT = "axis_v2_draft";
const TRASH_DAYS = 30;

let state = { version: 2, clients: {}, sessions: {}, updatedAt: nowISO() };
const listeners = new Set();

function readJSON(key, fallback){
  try{ const x = JSON.parse(localStorage.getItem(key) || "null"); return x ?? fallback }
  catch(e){ return fallback }
}
function emit(){ listeners.forEach(fn => { try{ fn(state) }catch(e){ console.error(e) } }) }

function persist(){
  state.updatedAt = nowISO();
  localStorage.setItem(KEY_STATE, JSON.stringify(state));
  emit();
}

export function subscribe(fn){ listeners.add(fn); return () => listeners.delete(fn) }
export function getState(){ return state }

/* 保存されたものを読み直す。何も無ければ空に戻す（読み込み前の状態を引きずらない）。 */
export function load(){
  const saved = readJSON(KEY_STATE, null);
  state = (saved && saved.version === 2)
    ? {
        version: 2,
        clients: saved.clients && typeof saved.clients === "object" ? saved.clients : {},
        sessions: saved.sessions && typeof saved.sessions === "object" ? saved.sessions : {},
        updatedAt: saved.updatedAt || nowISO()
      }
    : { version: 2, clients: {}, sessions: {}, updatedAt: nowISO() };
  purgeTrash();
  return state;
}

/* 30日を過ぎた削除済みは本当に捨てる */
function purgeTrash(){
  const limit = Date.now() - TRASH_DAYS * 86400000;
  let changed = false;
  Object.values(state.sessions).forEach(s => {
    if(!s.deletedAt) return;
    const t = Date.parse(s.deletedAt);
    if(Number.isFinite(t) && t < limit){ delete state.sessions[s.id]; changed = true }
  });
  if(changed) persist();
}

/* ---- 利用者 ---- */
export function clients({ includeInactive = false } = {}){
  return Object.values(state.clients)
    .filter(c => includeInactive || c.active !== false)
    .sort((a, b) => a.name.localeCompare(b.name, "ja"));
}
export function client(id){ return state.clients[id] || null }
export function clientName(id){ return state.clients[id]?.name || "" }

export function upsertClient(c){
  const id = c.id || newId("c");
  state.clients[id] = { ...state.clients[id], ...c, id, updatedAt: nowISO() };
  persist();
  return state.clients[id];
}
export function clientByName(name){
  const n = String(name || "").trim();
  return Object.values(state.clients).find(c => c.name === n) || null;
}

/* ---- セッション ---- */
export function sessions({ clientId = "", includeDeleted = false } = {}){
  return Object.values(state.sessions)
    .filter(s => (includeDeleted || !s.deletedAt) && (!clientId || s.clientId === clientId))
    .sort((a, b) => (b.date + b.createdAt).localeCompare(a.date + a.createdAt));
}
export function session(id){ return state.sessions[id] || null }

export function saveSession(s){
  const norm = normalizeSession(s);
  norm.updatedAt = nowISO();
  state.sessions[norm.id] = norm;
  persist();
  return norm;
}
export function deleteSession(id){
  const s = state.sessions[id];
  if(!s) return null;
  s.deletedAt = nowISO();
  persist();
  return s;
}
export function restoreSession(id){
  const s = state.sessions[id];
  if(!s) return null;
  s.deletedAt = null;
  s.updatedAt = nowISO();
  persist();
  return s;
}
export function purgeSession(id){
  if(!state.sessions[id]) return;
  delete state.sessions[id];
  persist();
}
export function trash(){
  return Object.values(state.sessions)
    .filter(s => s.deletedAt)
    .sort((a, b) => String(b.deletedAt).localeCompare(String(a.deletedAt)));
}
export function emptyTrash(){
  trash().forEach(s => { delete state.sessions[s.id] });
  persist();
}

/* これまでに使った種目名。入力候補に出す。 */
export function exerciseNames(){
  const set = new Set();
  Object.values(state.sessions).forEach(s =>
    s.exercises.forEach(e => { if(e.name) set.add(e.name) }));
  return [...set].sort((a, b) => a.localeCompare(b, "ja"));
}

/* 同じ利用者の、その日より前のいちばん新しいセッション */
export function previousSession(clientId, date, excludeId = ""){
  return sessions({ clientId })
    .filter(s => s.id !== excludeId && s.date < date)[0] || null;
}

/* ---- 旧データの取り込み ---- */
/* id は元データから決まるので、同じものを二度入れない。
   既に v2 側にあるものは触らない（v2での編集が勝つ）。 */
export function mergeImported({ clients: cs = {}, sessions: ss = [] } = {}){
  let added = 0;
  Object.values(cs).forEach(c => {
    if(!state.clients[c.id]) state.clients[c.id] = c;
  });
  ss.forEach(raw => {
    if(state.sessions[raw.id]) return;
    state.sessions[raw.id] = normalizeSession(raw);
    added += 1;
  });
  persist();
  return added;
}

/* ---- 書きかけの記録 ---- */
/* ペアトレでは2人ぶんを同時に持つので、利用者ごとに分けて覚える。 */
export function drafts(){
  const raw = readJSON(KEY_DRAFT, null);
  if(!raw || typeof raw !== "object") return {};
  if(Array.isArray(raw.exercises)) return { [raw.clientId || ""]: raw };   // 1人ぶんだった頃の形
  return raw;
}
export function saveDraft(s){
  if(!s) return;
  const d = drafts();
  d[s.clientId || ""] = s;
  localStorage.setItem(KEY_DRAFT, JSON.stringify(d));
}
export function clearDraft(clientId){
  if(clientId === undefined){ localStorage.removeItem(KEY_DRAFT); return }
  const d = drafts();
  delete d[clientId || ""];
  if(Object.keys(d).length) localStorage.setItem(KEY_DRAFT, JSON.stringify(d));
  else localStorage.removeItem(KEY_DRAFT);
}

/* ---- 持ち出し・取り込み ---- */
export function exportBackup(){
  return { app: "axis", version: 2, exportedAt: nowISO(), clients: state.clients, sessions: state.sessions };
}
export function importBackup(data){
  if(!data || data.version !== 2) throw new Error("このファイルは読み込めません");
  let n = 0;
  Object.values(data.clients || {}).forEach(c => { if(c?.id && !state.clients[c.id]) state.clients[c.id] = c });
  Object.values(data.sessions || {}).forEach(s => {
    if(!s?.id) return;
    const cur = state.sessions[s.id];
    if(!cur || String(s.updatedAt) > String(cur.updatedAt)){ state.sessions[s.id] = normalizeSession(s); n += 1 }
  });
  persist();
  return n;
}

export { today };
