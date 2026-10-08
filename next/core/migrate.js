/* 旧アプリのデータを v2 の形へ取り込む。
   - 旧アプリ側のキーは読むだけで、書き換えない（並行して使い続けられる）
   - セッションの id は元データから決まるので、何度取り込んでも増えない
   - 既にv2側にある記録は上書きしない（v2での編集が勝つ） */

import { BODYWEIGHT, makeSet, newId, nowISO, normWeight, num, today } from "./model.js?v=14";

const KEY_ADDED = "axis_training_added";
const KEY_EDITS = "axis_training_edits_v1";
const KEY_REG   = "axis_client_registry_v1";
const KEY_TRASH = "axis_training_trash_v1";
const KEY_TOMB  = "axis_training_deleted_v1";

function readJSON(key, fallback){
  try{ const x = JSON.parse(localStorage.getItem(key) || "null"); return x ?? fallback }
  catch(e){ return fallback }
}
function hash32(s){
  let h = 2166136261;
  for(const ch of String(s)){ h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) }
  return (h >>> 0).toString(16).toUpperCase().padStart(8, "0");
}
const clientIdFor = name => "c:" + hash32(String(name || "").trim());

/* ---- 利用者 ---- */
/* 旧データは「名前」が主キーで、改名は別名表で繋いでいた。
   v2では id が主キーなので、別名はここで id に畳む。 */
function buildClients(base, added, meta){
  const reg = readJSON(KEY_REG, {}) || {};
  const byName = new Map();          // 名前・別名 → clientId
  const clients = {};

  Object.entries(reg).forEach(([key, rec]) => {
    const name = String(rec?.name || (!String(key).startsWith("c_") ? key : "")).trim();
    if(!name) return;
    const id = String(rec?.id || clientIdFor(name));
    clients[id] = {
      id, name,
      goal: String(rec?.goal || meta?.goals?.[name] || ""),
      attention: String(meta?.attention?.[name] || ""),
      active: rec?.active !== false,
      createdAt: nowISO(), updatedAt: nowISO()
    };
    [key, name, ...(Array.isArray(rec?.aliases) ? rec.aliases : [])]
      .map(x => String(x || "").trim())
      .filter(Boolean)
      .forEach(a => byName.set(a, id));
  });

  const seen = name => {
    const n = String(name || "").trim();
    if(!n) return "";
    if(byName.has(n)) return byName.get(n);
    const id = clientIdFor(n);
    byName.set(n, id);
    if(!clients[id]) clients[id] = {
      id, name: n,
      goal: String(meta?.goals?.[n] || ""),
      attention: String(meta?.attention?.[n] || ""),
      active: true, createdAt: nowISO(), updatedAt: nowISO()
    };
    return id;
  };

  base.forEach(r => seen(r.client));
  added.forEach(s => seen(s.client));
  return { clients, nameToId: n => seen(n) };
}


/* 元データのメモは「気づき：… 注意：… 共有：…」が1つの文にまとまっている。
   本人向けまとめに注意点を出さないため、取り込みのときに分けておく。
   【…】の但し書きと「原文は…」の処理メモは、本人に見せない注意点側へ寄せる。 */
export function splitMemo(text){
  const raw = String(text || "").trim();
  const empty = { insight: "", caution: "", share: "", next: "" };
  if(!raw) return empty;
  if(!/気づき[:：]/.test(raw)) return { ...empty, insight: raw };

  const inner = [];
  let body = raw.replace(/【[^】]*】/g, m => { inner.push(m.replace(/[【】]/g, "")); return "" });
  const note = body.match(/原文は.*$/);
  if(note){ inner.push(note[0].trim()); body = body.slice(0, note.index) }

  const out = { ...empty };
  const parts = body.split(/(気づき|注意点?|共有|次回)[:：]/);
  let lead = (parts[0] || "").trim();
  for(let i = 1; i < parts.length; i += 2){
    const key = parts[i];
    const val = String(parts[i + 1] || "").trim();
    if(/気づき/.test(key))      out.insight = [lead, val].filter(Boolean).join(" ");
    else if(/注意/.test(key))   out.caution = val;
    else if(/共有/.test(key))   out.share = val;
    else if(/次回/.test(key))   out.next = val;
    lead = "";
  }
  if(!out.insight) out.insight = lead;
  if(inner.length) out.caution = [out.caution, ...inner].filter(Boolean).join(" ");
  return out;
}

/* ---- 既存記録（data.enc）→ セッション ---- */
function legacySessions(base, nameToId){
  const map = new Map();
  base.forEach(r => {
    const clientId = nameToId(r.client);
    const date = String(r.date || "").slice(0, 10);
    if(!clientId || !date) return;
    const id = "legacy:" + date + ":" + clientId;
    if(!map.has(id)) map.set(id, {
      id, clientId, date,
      status: String(r.achieved || "完了"),
      rpe: "", pain: "",
      notes: splitMemo(r.memo),
      exercises: [], done: {}, source: "legacy",
      createdAt: date + "T00:00:00.000Z", updatedAt: date + "T00:00:00.000Z", deletedAt: null
    });
    const s = map.get(id);
    const count = Math.max(1, Math.round(num(r.sets, 1)));
    s.exercises.push({
      id: newId("e"),
      name: String(r.exercise || "").trim(),
      sets: Array.from({length: count}, () => makeSet(normWeight(r.weight), num(r.reps, 0)))
    });
    if(!s.notes.insight && r.memo) s.notes = splitMemo(r.memo);
  });
  return [...map.values()];
}

/* ---- 旧アプリ保存分 → セッション ---- */
function exercisesFromOld(list){
  return (Array.isArray(list) ? list : []).map(e => {
    const steps = Array.isArray(e.steps) && e.steps.length ? e.steps : null;
    const sets = steps
      ? steps.map(x => makeSet(normWeight(x.w), x.r))
      : Array.from({length: Math.max(1, Math.round(num(e.sets, 1)))}, () => makeSet(normWeight(e.weight), num(e.reps, 0)));
    return { id: newId("e"), name: String(e.exercise || "").trim(), sets };
  });
}
function appSessions(added, nameToId){
  return (Array.isArray(added) ? added : []).map(s => {
    const stamp = String(s.savedAt || "");
    return {
      id: "app:" + (stamp || hash32(JSON.stringify([s.date, s.client, s.exercises]))),
      clientId: nameToId(s.client),
      date: String(s.date || today()).slice(0, 10),
      status: String(s.status || "完了"),
      rpe: s.rpe ?? "", pain: s.pain ?? "",
      notes: {
        insight: String(s.insight ?? s.note ?? ""),
        caution: String(s.caution ?? ""),
        share:   String(s.share ?? ""),
        next:    String(s.next ?? "")
      },
      exercises: exercisesFromOld(s.exercises),
      done: {}, source: "app",
      createdAt: stamp || nowISO(),
      updatedAt: stamp || nowISO(),
      deletedAt: null
    };
  });
}

/* ---- 旧「非表示・修正」の上書き層を、セッション本体へ畳む ---- */
/* 旧形式の鍵は2種類ある：
   ["app-v2", 保存時刻, 種目の番号]            … アプリ保存分
   [日付, 利用者, 種目, 出所, 同じ行の通し番号] … 既存記録 */
function applyOldEdits(sessions, nameToId){
  const edits = readJSON(KEY_EDITS, {}) || {};
  const byId = new Map(sessions.map(s => [s.id, s]));
  const legacyCursor = new Map();

  const findLegacy = key => {
    const [date, client, exercise, , n] = key;
    const s = byId.get("legacy:" + String(date).slice(0,10) + ":" + nameToId(client));
    if(!s) return null;
    const hits = s.exercises.filter(e => e.name === exercise);
    return hits[Number(n) || 0] ? { session: s, exercise: hits[Number(n) || 0] } : null;
  };

  Object.entries(edits).forEach(([raw, e]) => {
    if(!e || e.restored) return;
    let key;
    try{ key = JSON.parse(raw) }catch(err){ return }
    let hit = null;
    if(Array.isArray(key) && key[0] === "app-v2"){
      const s = byId.get("app:" + key[1]);
      if(s) hit = { session: s, exercise: s.exercises[Number(key[2]) || 0] };
    }else if(Array.isArray(key)){
      hit = findLegacy(key);
    }
    if(!hit || !hit.exercise) return;

    if(e.deleted){
      hit.session.exercises = hit.session.exercises.filter(x => x !== hit.exercise);
      if(!hit.session.exercises.length) hit.session.deletedAt = e.updatedAt || nowISO();
      return;
    }
    const p = e.patch || {};
    if(p.exercise) hit.exercise.name = String(p.exercise);
    if(p.weight !== undefined || p.reps !== undefined || p.sets !== undefined){
      const count = Math.max(1, Math.round(num(p.sets, hit.exercise.sets.length)));
      const w = p.weight !== undefined ? normWeight(p.weight) : hit.exercise.sets[0]?.weight ?? 0;
      const r = p.reps !== undefined ? num(p.reps, 0) : hit.exercise.sets[0]?.reps ?? 0;
      hit.exercise.sets = Array.from({length: count}, () => makeSet(w, r));
    }
    hit.session.updatedAt = e.updatedAt || nowISO();
    legacyCursor.set(raw, true);
  });
  return sessions;
}

/* ---- v26のゴミ箱・削除の印 ---- */
function applyOldDeletes(sessions, nameToId){
  const tombs = readJSON(KEY_TOMB, {}) || {};
  const trash = readJSON(KEY_TRASH, []) || [];
  const byId = new Map(sessions.map(s => [s.id, s]));

  // ゴミ箱にしか残っていない記録も、削除済みとして取り込む（v2側で戻せるように）
  trash.forEach(x => {
    const stamp = x?.session?.savedAt;
    if(!stamp || byId.has("app:" + stamp)) return;
    const s = appSessions([x.session], nameToId)[0];
    s.deletedAt = x.deletedAt || nowISO();
    sessions.push(s);
    byId.set(s.id, s);
  });
  Object.entries(tombs).forEach(([stamp, at]) => {
    const s = byId.get("app:" + stamp);
    if(s) s.deletedAt = at || nowISO();
  });
  return sessions;
}

/* すでに取り込み済みの記録にも同じ手当てをする。
   前の版で1つにまとめて入れてしまった分を、あとから分け直す。 */
export function resplitLegacyNotes(sessions){
  let fixed = 0;
  Object.values(sessions || {}).forEach(s => {
    if(s?.source !== "legacy") return;
    if(!/気づき[:：]/.test(String(s.notes?.insight || ""))) return;
    s.notes = splitMemo(s.notes.insight);
    fixed += 1;
  });
  return fixed;
}

/* ---- 入口 ---- */
export function importLegacy({ base = [], meta = {} } = {}){
  const added = readJSON(KEY_ADDED, []) || [];
  const { clients, nameToId } = buildClients(base, added, meta);
  let sessions = [...legacySessions(base, nameToId), ...appSessions(added, nameToId)];
  sessions = applyOldEdits(sessions, nameToId);
  sessions = applyOldDeletes(sessions, nameToId);
  return { clients, sessions };
}
