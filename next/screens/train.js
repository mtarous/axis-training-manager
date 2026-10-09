/* トレ中入力。
   画面はこの1ファイルだけが描く。描き直しは render() の1本道。 */

import * as store from "../core/store.js?v=19";
import { BODYWEIGHT, makeExercise, makeSession, makeSet, num, round1, summarizeSets, today } from "../core/model.js?v=19";
import { el, esc, inlineEdit, toast } from "../ui/dom.js?v=19";
import * as rest from "../ui/rest-timer.js?v=19";

const STEPS = [1, 2.5, 5, 10];

let pool = {};           // 利用者id → 書きかけのセッション（ペアトレで2人ぶん持つ）
let current = null;      // いま編集しているセッション
let active = 0;          // 表示している種目の番号
let stepByEx = {};       // 種目id → ＋−の刻み
let editSet = 0;         // いま編集しているセットの番号

const ex = () => current.exercises[active];
const doneOf = id => (current.done[id] = Array.isArray(current.done[id]) ? current.done[id] : []);
const stepOf = id => STEPS.includes(stepByEx[id]) ? stepByEx[id] : 2.5;

function focus(i){
  const before = active;
  active = Math.max(0, Math.min(i, current.exercises.length - 1));
  if(active !== before) editSet = nextUndone();
  return active;
}
/* まだ記録していない最初のセット。全部終わっていれば最後のセット。 */
function nextUndone(){
  const e = ex();
  const list = doneOf(e.id);
  const i = e.sets.findIndex((_, j) => !list.includes(j));
  return i < 0 ? e.sets.length - 1 : i;
}
function clampEdit(){
  editSet = Math.max(0, Math.min(editSet, ex().sets.length - 1));
  return editSet;
}

/* ---- 開く ---- */
/* ペアの相手。設定されていなければ null */
function partnerOf(clientId){
  const c = store.client(clientId);
  const p = c?.partnerId ? store.client(c.partnerId) : null;
  return p && p.id !== clientId ? p : null;
}

function blank(clientId){
  const s = makeSession(clientId, current?.date || today());
  return s;
}

/* いま抱えているその人のぶんを出す。無ければ新しく作る。
   前回の書きかけを引き継ぐのは openDraftOrNew だけにする（新規は必ずまっさら）。 */
function sessionFor(clientId){
  if(!pool[clientId]) pool[clientId] = blank(clientId);
  return pool[clientId];
}

/* ペアが設定されていれば、相手のぶんも一緒に抱える */
function includePartner(clientId){
  const p = partnerOf(clientId);
  if(p) sessionFor(p.id);
}

function switchTo(clientId){
  if(!clientId) return;
  current = sessionFor(clientId);
  active = 0;
  editSet = 0;
  render();
}

export function openNew(clientId = ""){
  pool = {};
  current = blank(clientId);
  if(clientId) pool[clientId] = current;
  includePartner(clientId);
  active = 0;
  editSet = 0;
  stepByEx = {};
  render();
}

/* 直近のメニューをそのまま今日の記録として開く */
export function openFromPrevious(clientId){
  pool = {};
  const last = store.sessions({ clientId })[0];
  const s = makeSession(clientId, today());
  if(last){
    s.exercises = last.exercises.map(e =>
      makeExercise(e.name, e.sets.map(x => ({ weight: x.weight, reps: x.reps, side: x.side }))));
  }
  pool[clientId] = s;
  current = s;
  includePartner(clientId);
  active = 0;
  editSet = 0;
  stepByEx = {};
  render();
}

export function openSession(id){
  const s = store.session(id);
  if(!s) return;
  pool = {};
  current = JSON.parse(JSON.stringify(s));
  pool[current.clientId] = current;
  active = 0;
  editSet = 0;
  stepByEx = {};
  render();
}

export function openDraftOrNew(){
  const saved = store.drafts();
  const ids = Object.keys(saved).filter(k => saved[k]?.exercises?.length);
  if(ids.length){
    pool = {};
    ids.forEach(id => { pool[id] = saved[id] });
    current = pool[ids[0]];
    active = 0;
    editSet = 0;
    stepByEx = {};
    render();
  }else{
    openNew();
  }
}

function keep(){ Object.values(pool).forEach(s => { if(s.clientId) store.saveDraft(s) }) }

/* ---- 操作 ---- */
function bumpWeight(j, d){
  const s = ex().sets[j];
  if(String(s.weight) === BODYWEIGHT) s.weight = 0;
  s.weight = Math.max(0, round1(num(s.weight) + d));
  render();
}
function setWeight(j, v){
  if(v === null) return render();
  ex().sets[j].weight = v;
  render();
}
function bumpReps(j, d){
  const s = ex().sets[j];
  s.reps = Math.max(0, s.reps + d);
  render();
}
function setReps(j, v){
  if(v === null) return render();
  ex().sets[j].reps = Math.round(v);
  render();
}
function toggleBodyweight(j){
  const s = ex().sets[j];
  s.weight = String(s.weight) === BODYWEIGHT ? 0 : BODYWEIGHT;
  render();
}
function addSet(delta, ratio){
  const e = ex();
  const last = e.sets[e.sets.length - 1] || makeSet();
  let w = last.weight;
  if(String(w) !== BODYWEIGHT){
    if(Number.isFinite(ratio)) w = Math.max(0, round1(num(w) * ratio));
    else if(Number.isFinite(delta)) w = Math.max(0, round1(num(w) + delta));
  }
  e.sets.push(makeSet(w, last.reps, last.side));
  editSet = e.sets.length - 1;
  render();
}
function removeSet(j){
  const e = ex();
  if(e.sets.length <= 1) return;
  e.sets.splice(j, 1);
  current.done[e.id] = doneOf(e.id).filter(x => x !== j).map(x => x > j ? x - 1 : x);
  clampEdit();
  render();
}
function toggleSet(j){
  const e = ex();
  const list = doneOf(e.id);
  const k = list.indexOf(j);
  if(k >= 0) list.splice(k, 1);
  else {
    list.push(j);
    rest.start(rest.suggestSeconds(e.name, e.sets[j]?.reps));
  }
  render();
}
function recordNext(){
  const e = ex();
  if(doneOf(e.id).length >= e.sets.length) return;
  const j = clampEdit();
  if(!doneOf(e.id).includes(j)) toggleSet(j);
  editSet = nextUndone();
  render();
}
function addExercise(){
  current.exercises.push(makeExercise());
  focus(current.exercises.length - 1);
  render();
}
function removeExercise(){
  if(current.exercises.length <= 1) return;
  const [gone] = current.exercises.splice(active, 1);
  delete current.done[gone.id];
  focus(active - 1);
  render();
}
function usePrevious(){
  const prev = store.previousSession(current.clientId, current.date, current.id);
  const hit = prev?.exercises.find(e => e.name === ex().name);
  if(!hit) return;
  ex().sets = hit.sets.map(s => makeSet(s.weight, s.reps, s.side));
  current.done[ex().id] = [];
  render();
}

function save(){
  Object.values(pool).forEach(x => { x.exercises = x.exercises.filter(e => e.name.trim()) });
  const ready = Object.values(pool).filter(x => x.clientId && x.exercises.length);

  if(!ready.length){
    if(!current.clientId) alert("利用者を選んでください");
    else alert("種目を1つ以上入れてください");
    return;
  }

  const saved = ready.map(x => store.saveSession(x));
  saved.forEach(x => store.clearDraft(x.clientId));

  const names = saved.map(x => store.clientName(x.clientId)).join("・");
  const label = saved[0].date + "｜" + names;
  toast(saved.length > 1 ? saved.length + "人ぶん保存しました" : "保存しました", {
    detail: label,
    actionLabel: "取り消す",
    onAction: () => {
      saved.forEach(x => store.purgeSession(x.id));
      pool = {};
      saved.forEach(x => { pool[x.clientId] = JSON.parse(JSON.stringify(x)) });
      current = pool[saved[0].clientId];
      render();
      toast("保存を取り消しました", { detail: label, seconds: 6 });
    }
  });
  openNew(saved[0].clientId);
}

/* ---- 描画 ---- */
function previousLine(){
  const prev = store.previousSession(current.clientId, current.date, current.id);
  const hit = prev?.exercises.find(e => e.name === ex().name);
  if(!hit) return '<div class="tr-prev"><span>前回の記録なし</span></div>';
  return '<div class="tr-prev"><span>前回 ' + esc(summarizeSets(hit.sets)) + '</span>' +
    '<button type="button" class="ax-btn ghost" data-act="useprev">前回と同じ</button></div>';
}

/* いま記録するセットだけを大きく出す。他は一覧で眺めるだけにする。 */
function editor(){
  const e = ex();
  const j = clampEdit();
  const s = e.sets[j];
  const body = String(s.weight) === BODYWEIGHT;
  return '<label class="ax-field"><span>左右</span><select class="ax-select" id="tr-side">' + ['','左','右'].map(side => '<option value="' + side + '"' + ((s.side || '') === side ? ' selected' : '') + '>' + (side || '左右なし') + '</option>').join('') + '</select></label>' + '<div class="tr-editor">' +
    '<div class="tr-erow">' +
      '<span>重量</span>' +
      '<button type="button" data-act="w-" data-j="' + j + '">−</button>' +
      '<b class="tr-val" data-act="w=" data-j="' + j + '">' + (body ? BODYWEIGHT : esc(s.weight) + "<small>kg</small>") + '</b>' +
      '<button type="button" data-act="w+" data-j="' + j + '">＋</button>' +
      '<button type="button" class="tr-sub' + (body ? " on" : "") + '" data-act="body" data-j="' + j + '">自重</button>' +
    '</div>' +
    '<div class="tr-erow">' +
      '<span>回数</span>' +
      '<button type="button" data-act="r-" data-j="' + j + '">−</button>' +
      '<b class="tr-val" data-act="r=" data-j="' + j + '">' + esc(s.reps) + '<small>回</small></b>' +
      '<button type="button" data-act="r+" data-j="' + j + '">＋</button>' +
      '<span class="tr-spacer"></span>' +
    '</div>' +
  '</div>';
}

function setList(doneList){
  const e = ex();
  return '<div class="tr-list">' + e.sets.map((s, j) => {
    const done = doneList.includes(j);
    return '<div class="tr-li' + (done ? " done" : "") + (j === editSet ? " on" : "") + '">' +
      '<button type="button" class="tr-licheck" data-act="toggle" data-j="' + j + '" aria-label="SET ' + (j + 1) + 'の完了を切り替え">' + (done ? "✓" : "○") + '</button>' +
      '<button type="button" class="tr-libody" data-act="pick" data-j="' + j + '">' +
        '<i>SET ' + (j + 1) + (s.side ? ' · ' + s.side : '') + '</i>' +
        '<b>' + (String(s.weight) === BODYWEIGHT ? BODYWEIGHT : esc(s.weight) + "kg") + ' × ' + esc(s.reps) + '回</b>' +
      '</button>' +
      '<button type="button" class="tr-lidel" data-act="delset" data-j="' + j + '"' + (e.sets.length <= 1 ? " disabled" : "") + ' aria-label="このセットを削除">×</button>' +
    '</div>';
  }).join("") + '</div>';
}

export function render(){
  const root = el("#view-train");
  if(!root || !current) return;
  if(!current.exercises.length) current.exercises.push(makeExercise());
  focus(active);

  const e = ex();
  const step = stepOf(e.id);
  const doneList = doneOf(e.id);
  const total = current.exercises.length;
  const cs = store.clients();
  const keepY = window.scrollY;

  root.innerHTML =
  '<div class="tr-bar">' +
    '<select id="tr-client" class="ax-select" aria-label="利用者">' +
      '<option value="">利用者を選ぶ</option>' +
      cs.map(c => '<option value="' + esc(c.id) + '"' + (c.id === current.clientId ? " selected" : "") + '>' + esc(c.name) + '</option>').join("") +
    '</select>' +
    '<input id="tr-date" class="ax-input" type="date" value="' + esc(current.date) + '" aria-label="日付">' +
    '<button class="ax-btn pri" data-act="save">保存</button>' +
  '</div>' +

  pairBar() +

  (total > 1 ? '<div class="tr-dots">' +
    current.exercises.map((x, k) => {
      const d = doneOf(x.id).length;
      const cls = d >= x.sets.length ? "done" : d ? "part" : "";
      return '<button type="button" class="' + cls + (k === active ? " on" : "") + '" data-act="go" data-i="' + k + '" title="' + esc(x.name || ("種目" + (k + 1))) + '"></button>';
    }).join("") +
  '</div>' : "") +

  '<section class="ax-panel tr-card">' +
    '<div class="tr-nav">' +
      '<button type="button" data-act="prev"' + (active === 0 ? " disabled" : "") + ' aria-label="前の種目">‹</button>' +
      '<b>種目 ' + (active + 1) + ' / ' + total + '</b>' +
      '<button type="button" data-act="next"' + (active === total - 1 ? " disabled" : "") + ' aria-label="次の種目">›</button>' +
    '</div>' +

    '<input id="tr-name" class="ax-input tr-name" list="tr-exlist" placeholder="種目名を入れる" value="' + esc(e.name) + '" autocomplete="off">' +
    '<datalist id="tr-exlist">' + store.exerciseNames().map(n => '<option value="' + esc(n) + '"></option>').join("") + '</datalist>' +

    previousLine() +

    '<button class="tr-record' + (doneList.length >= e.sets.length ? " full" : "") + '" data-act="record"' + (doneList.length >= e.sets.length ? " disabled" : "") + '>' +
      (doneList.length >= e.sets.length ? "この種目は完了" : "SET " + (clampEdit() + 1) + " を記録する") +
      '<small>' + doneList.length + ' / ' + e.sets.length + ' セット完了</small>' +
    '</button>' +

    editor() +
    setList(doneList) +

    '<div class="tr-steprow">' +
      '<span>刻み</span>' +
      STEPS.map(s => '<button type="button" class="' + (s === step ? "on" : "") + '" data-act="step" data-s="' + s + '">' + s + 'kg</button>').join("") +
      '<small>数字をタップすると直接入力</small>' +
    '</div>' +

    '<div class="tr-add">' +
      '<button type="button" class="ax-btn full" data-act="addset">＋ もう1セット</button>' +
      '<button type="button" class="ax-btn" data-act="dropkg">−' + step + 'kgで追加</button>' +
      '<button type="button" class="ax-btn" data-act="dropratio">−20%で追加</button>' +
    '</div>' +

    '<div class="tr-exacts">' +
      '<button type="button" class="ax-btn ghost" data-act="addex">＋ 種目を追加</button>' +
      (total > 1 ? '<button type="button" class="ax-btn ghost danger" data-act="delex">この種目を削除</button>' : "") +
    '</div>' +
  '</section>' +

  '<details class="ax-panel tr-memo"' + (hasMemo() ? " open" : "") + '>' +
    '<summary>メモ（気づき・注意点・共有・次回）</summary>' +
    '<div class="tr-memobody">' +
      memoField("insight", "今日の気づき") +
      memoField("caution", "注意点") +
      memoField("share",   "共有事項") +
      memoField("next",    "次回やること") +
      '<div class="tr-selects">' +
        selectField("status", "状態", ["完了","良好","要確認","変更"]) +
        selectField("rpe",    "RPE",  ["", 1,2,3,4,5,6,7,8,9,10]) +
        selectField("pain",   "痛み",  ["", 0,1,2,3,4,5,6,7,8,9,10]) +
      '</div>' +
    '</div>' +
  '</details>';

  bind(root);
  keep();
  if(Math.abs(window.scrollY - keepY) > 1) window.scrollTo(0, keepY);
}

/* ペアトレの切り替え。相手が設定されている人のときだけ出す。 */
function pairBar(){
  const partner = partnerOf(current.clientId);
  if(!partner) return "";
  const me = store.client(current.clientId);
  /* 切り替えても並び順が入れ替わらないようにする（押す場所が動くと間違えるため） */
  const people = [me, partner].sort((a, b) => a.id.localeCompare(b.id));
  return '<div class="tr-pair-bar">' +
    people.map(p => {
      const s = pool[p.id];
      const done = s ? s.exercises.filter(e => e.name.trim()).length : 0;
      return '<button type="button" class="' + (p.id === current.clientId ? "on" : "") + '" data-act="who" data-id="' + esc(p.id) + '">' +
        '<b>' + esc(p.name) + '</b><i>' + (done ? done + "種目" : "未入力") + '</i></button>';
    }).join("") +
  '</div>';
}

function hasMemo(){
  return Object.values(current.notes).some(Boolean);
}
function memoField(key, label){
  return '<label class="ax-field"><span>' + esc(label) + '</span>' +
    '<textarea class="ax-area" data-note="' + key + '">' + esc(current.notes[key]) + '</textarea></label>';
}
function selectField(key, label, options){
  return '<label class="ax-field"><span>' + esc(label) + '</span><select class="ax-select" data-meta="' + key + '">' +
    options.map(o => '<option value="' + esc(o) + '"' + (String(current[key]) === String(o) ? " selected" : "") + '>' + (o === "" ? "-" : esc(o)) + '</option>').join("") +
    '</select></label>';
}

/* 画面の操作はここで1本にまとめる。描画側に onclick を書かない。 */
function bind(root){
  root.onclick = ev => {
    const t = ev.target.closest("[data-act]");
    if(!t) return;
    const j = Number(t.dataset.j);
    const step = stepOf(ex().id);
    switch(t.dataset.act){
      case "save":      save(); break;
      case "go":        focus(Number(t.dataset.i)); render(); break;
      case "who":       switchTo(t.dataset.id); break;
      case "prev":      focus(active - 1); render(); break;
      case "next":      focus(active + 1); render(); break;
      case "record":    recordNext(); break;
      case "toggle":    toggleSet(j); break;
      case "pick":      editSet = j; render(); break;
      case "w-":        bumpWeight(j, -step); break;
      case "w+":        bumpWeight(j, step); break;
      case "r-":        bumpReps(j, -1); break;
      case "r+":        bumpReps(j, 1); break;
      case "w=":        inlineEdit(t, String(ex().sets[j].weight) === BODYWEIGHT ? 0 : ex().sets[j].weight, v => setWeight(j, v)); break;
      case "r=":        inlineEdit(t, ex().sets[j].reps, v => setReps(j, v)); break;
      case "body":      toggleBodyweight(j); break;
      case "delset":    removeSet(j); break;
      case "step":      stepByEx[ex().id] = Number(t.dataset.s); render(); break;
      case "addset":    addSet(); break;
      case "dropkg":    addSet(-step); break;
      case "dropratio": addSet(undefined, 0.8); break;
      case "addex":     addExercise(); break;
      case "delex":     removeExercise(); break;
      case "useprev":   usePrevious(); break;
    }
  };
  root.querySelector("#tr-client").onchange = e => {
    const id = e.target.value;
    /* 種目を入れる前に選び直したときは、その場で付け替える */
    if(current.clientId && pool[current.clientId] === current) delete pool[current.clientId];
    current.clientId = id;
    if(id) pool[id] = current;
    includePartner(id);
    render();
  };
  root.querySelector("#tr-side").onchange = ev => { ex().sets[clampEdit()].side = ev.target.value; render() };
  root.querySelector("#tr-date").onchange   = e => { current.date = e.target.value; render() };
  root.querySelector("#tr-name").oninput    = e => { ex().name = e.target.value; keep() };
  root.querySelectorAll("[data-note]").forEach(a => a.oninput = e => { current.notes[e.target.dataset.note] = e.target.value; keep() });
  root.querySelectorAll("[data-meta]").forEach(a => a.onchange = e => { current[e.target.dataset.meta] = e.target.value; keep() });
}
