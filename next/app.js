/* AXIS v2 起動と画面の切り替え。
   ここは繋ぐだけ。画面の中身は screens/ が持つ。 */

import { decryptBlob } from "./core/crypto.js";
import { importLegacy } from "./core/migrate.js";
import * as store from "./core/store.js";
import { el } from "./ui/dom.js";
import * as train from "./screens/train.js";
import * as history from "./screens/history.js";

const KEY_CODE = "axis_training_key";
let view = "train";

function show(name){
  view = name;
  document.querySelectorAll(".ax-view").forEach(v => v.classList.toggle("on", v.id === "view-" + name));
  document.querySelectorAll(".ax-nav button").forEach(b => b.classList.toggle("on", b.dataset.v === name));
  if(name === "train") train.render();
  if(name === "history") history.render();
  window.scrollTo(0, 0);
}

async function unlock(code){
  const msg = el("#lockmsg");
  msg.textContent = "読み込んでいます…";
  try{
    const data = await decryptBlob("../data.enc", code);
    store.load();
    const imported = importLegacy({ base: data.history || [], meta: data });
    store.mergeImported(imported);

    if(el("#remember").checked) localStorage.setItem(KEY_CODE, code);
    el("#lock").hidden = true;
    el("#app").hidden = false;
    el("#nav").hidden = false;

    history.setEditHandler(id => { train.openSession(id); show("train") });
    train.openDraftOrNew();
    show("train");
  }catch(e){
    console.error(e);
    msg.textContent = "アクセスコードが違うか、データを読み込めません。";
  }
}

/* データを持たずに動かす（確認用）。本番の入口からは使わない。 */
export function startWithoutData(){
  store.load();
  el("#lock").hidden = true;
  el("#app").hidden = false;
  el("#nav").hidden = false;
  history.setEditHandler(id => { train.openSession(id); show("train") });
  train.openDraftOrNew();
  show("train");
}

function boot(){
  el("#unlock").addEventListener("click", () => unlock(el("#pass").value));
  el("#pass").addEventListener("keydown", e => { if(e.key === "Enter") unlock(el("#pass").value) });
  document.querySelectorAll(".ax-nav button").forEach(b => b.addEventListener("click", () => show(b.dataset.v)));
  store.subscribe(() => { if(view === "history") history.render() });

  const saved = localStorage.getItem(KEY_CODE);
  if(saved){ el("#pass").value = saved; unlock(saved) }
}

window.axisDev = { store, train, history, startWithoutData };
boot();
