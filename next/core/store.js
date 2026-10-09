/* AXIS v2 データの置き場。
   状態を変える道はここだけ。画面は読むだけで、直接 localStorage に触らない。 */

import { newId, normalizeSession, nowISO, today } from "./model.js?v=21";

const KEY_STATE = "axis_v2_state";
const KEY_DRAFT = "axis_v2_draft";
const TRASH_DAYS = 30;

/* 峰岡夫婦は予約上は1枠だが、実績は2人別々に持つ。
   旧「峰岡夫婦」のトレーニング記録は、ユーザー指定により宏晃さん・多江さんの両方へ同内容を複製する。
   複製IDは元記録と利用者IDから固定し、何度起動しても増えない。 */
const PAIR_MIGRATIONS = [
  { label: "峰岡夫婦", legacy: ["峰岡夫婦", "峰岡夫妻"], members: ["峰岡 宏晃", "峰岡 多江"] }
];
const compactName = v => String(v || "").replace(/[\s　]+/g, "");
const pairMirrorId = (sourceId, memberId) => `pair-mirror:${sourceId}:${memberId}`;

function ensurePairMigrations(){
  let changed = false;
  const all = () => Object.values(state.clients);

  PAIR_MIGRATIONS.forEach(spec => {
    const legacyNames = new Set(spec.legacy.map(compactName));
    const old = all().find(c => legacyNames.has(compactName(c.name)));
    const existing = spec.members.map(name => all().find(c => compactName(c.name) === compactName(name)) || null);

    /* 関係するデータが無い端末には勝手に利用者を増やさない。 */
    if(!old && !existing.some(Boolean)) return;

    const members = spec.members.map((name, i) => {
      if(existing[i]) return existing[i];
      const id = newId("c");
      state.clients[id] = {
        id, name, goal: "", attention: "", partnerId: "", pairLabel: spec.label, active: true,
        createdAt: nowISO(), updatedAt: nowISO()
      };
      changed = true;
      return state.clients[id];
    });

    const [a, b] = members;
    if(a.partnerId !== b.id || a.pairLabel !== spec.label || a.active === false){
      Object.assign(a, { partnerId: b.id, pairLabel: spec.label, active: true, updatedAt: nowISO() });
      changed = true;
    }
    if(b.partnerId !== a.id || b.pairLabel !== spec.label || b.active === false){
      Object.assign(b, { partnerId: a.id, pairLabel: spec.label, active: true, updatedAt: nowISO() });
      changed = true;
    }

    if(old){
      /* 旧ペア記録は2人の履歴に同じ内容で反映。元記録は消さない。 */
      const sourceSessions = Object.values(state.sessions).filter(x => x.clientId === old.id);
      sourceSessions.forEach(source => {
        members.forEach(member => {
          const id = pairMirrorId(source.id, member.id);
          const cur = state.sessions[id];
          /* 本人側で編集した後は pairSourceId が落ちるので、その内容を上書きしない。 */
          if(cur && cur.pairSourceId !== source.id) return;
          if(cur && String(cur.pairSourceUpdatedAt || "") >= String(source.updatedAt || "")) return;
          const copy = JSON.parse(JSON.stringify(source));
          state.sessions[id] = {
            ...copy,
            id,
            clientId: member.id,
            pairSourceId: source.id,
            pairSourceUpdatedAt: source.updatedAt || ""
          };
          changed = true;
        });
      });

      if(old.active !== false || old.legacyPairLabel !== spec.label){
        Object.assign(old, { active: false, legacyPairLabel: spec.label, updatedAt: nowISO() });
        changed = true;
      }
    }
  });
  return changed;
}

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
  if(ensurePairMigrations()) persist();
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

/* 取り込み済みの記録に後から手当てをする。直した件数を返す。 */
export function repair(fn){
  const n = fn(state.sessions) || 0;
  if(n) persist();
  return n;
}

/* ---- 旧データの取り込み ---- */
/* id は元データから決まるので、同じものを二度入れない。
   既に v2 側にあるものは触らない（v2での編集が勝つ）。 */
export function mergeImported({ clients: cs = {}, sessions: ss = [] } = {}){
  let added = 0;
  const clientIdMap = {};

  /* 旧データ側と新アプリ側でIDが違っても、同名の既存利用者が1人だけならその人へ統合する。
     同姓同名が複数いる場合は誤結合を避け、自動では統合しない。 */
  Object.values(cs).forEach(c => {
    if(!c?.id) return;
    if(state.clients[c.id]){
      clientIdMap[c.id] = c.id;
      return;
    }
    const key = compactName(c.name);
    const matches = key ? Object.values(state.clients).filter(x => compactName(x.name) === key) : [];
    if(matches.length === 1){
      const target = matches[0];
      clientIdMap[c.id] = target.id;
      /* 新アプリ側で未入力の補足だけ、旧データから補う。既存編集は上書きしない。 */
      if(!target.goal && c.goal) target.goal = c.goal;
      if(!target.attention && c.attention) target.attention = c.attention;
      return;
    }
    state.clients[c.id] = c;
    clientIdMap[c.id] = c.id;
  });

  ss.forEach(raw => {
    if(state.sessions[raw.id]) return;
    const mapped = { ...raw, clientId: clientIdMap[raw.clientId] || raw.clientId };
    state.sessions[raw.id] = normalizeSession(mapped);
    added += 1;
  });
  ensurePairMigrations();
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
  const clientIds = {};
  // 画像からの復元は、同名の既存利用者が1人ならその人へ追加する。
  const incomingClients = Object.values(data.clients || {});
  incomingClients.forEach(c => {
    if(!c?.id) return;
    let id = c.id;
    if(data.restoreClientByName === true && !state.clients[id]){
      const matches = Object.values(state.clients).filter(x => x.name?.trim() === c.name?.trim());
      if(matches.length > 1) throw new Error("同名の利用者が複数いるため、復元先を決められません");
      if(matches.length === 1) id = matches[0].id;
    }
    clientIds[c.id] = id;
  });
  incomingClients.forEach(c => {
    if(c?.id && !state.clients[clientIds[c.id]]) state.clients[clientIds[c.id]] = { ...c, id: clientIds[c.id] };
  });
  Object.values(data.sessions || {}).forEach(s => {
    if(!s?.id) return;
    const cur = state.sessions[s.id];
    if(!cur || String(s.updatedAt) > String(cur.updatedAt)){ state.sessions[s.id] = normalizeSession({ ...s, clientId: clientIds[s.clientId] || s.clientId }); n += 1 }
  });
  persist();
  return n;
}

export { today };
