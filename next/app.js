/* AXIS v2 起動と画面の切り替え。
   ここは繋ぐだけ。画面の中身は screens/ が持つ。 */

import { decryptBlob } from "./core/crypto.js";
import { importLegacy } from "./core/migrate.js";
import { setMeta } from "./core/meta.js";
import * as store from "./core/store.js";
import { el } from "./ui/dom.js";
import * as home from "./screens/home.js";
import * as clients from "./screens/clients.js";
import * as report from "./screens/report.js";
import * as schedule from "./screens/schedule.js";
import * as history from "./screens/history.js";
import * as train from "./screens/train.js";
import * as settings from "./screens/settings.js";
import * as calendar from "./features/calendar.js";

const KEY_CODE = "axis_training_key";
/* 暗号化データはリポジトリの一番上にある。
   このHTMLがどこに置かれても同じ場所を指すよう、モジュールの位置から数える。 */
const dataURL = name => new URL("../" + name, import.meta.url).href;
const TABS = ["home", "schedule", "clients", "history", "train"];
/* 下のタブに出さない画面は、どのタブを光らせるかだけ決める */
const TAB_OF = { client: "clients", report: "clients", settings: "home" };

let view = "home";

export function go(name, arg){
  if(name === "train-from"){ train.openFromPrevious(arg); return go("train") }
  if(name === "train-session"){ train.openSession(arg); return go("train") }
  if(name === "client"){ clients.setCurrent(arg); }
  if(name === "report"){ report.setCurrent(arg); }

  view = name;
  document.querySelectorAll(".ax-view").forEach(v => v.classList.toggle("on", v.id === "view-" + name));
  const tab = TAB_OF[name] || name;
  document.querySelectorAll(".ax-nav button").forEach(b => b.classList.toggle("on", b.dataset.v === tab));
  draw();
  window.scrollTo(0, 0);
}

function draw(){
  if(view === "home")     home.render();
  if(view === "schedule") schedule.render();
  if(view === "clients")  clients.renderList();
  if(view === "client")   clients.renderDetail();
  if(view === "report")   report.render();
  if(view === "history")  history.render();
  if(view === "train")    train.render();
  if(view === "settings") settings.render();
}

function startApp(){
  el("#lock").hidden = true;
  el("#app").hidden = false;
  el("#nav").hidden = false;
  [home, clients, report, schedule, settings].forEach(m => m.setRouter(go));
  history.setEditHandler(id => go("train-session", id));
  train.openDraftOrNew();
  go("home");
}

async function unlock(code){
  const msg = el("#lockmsg");
  msg.textContent = "読み込んでいます…";
  try{
    const data = await decryptBlob(dataURL("data.enc"), code);
    setMeta(data);
    try{
      const cal = await decryptBlob(dataURL("calendar-current.enc"), code);
      setMeta({ ...data, calendarEvents: cal.events || [], calendarSyncedAt: cal.syncedAt || "" });
    }catch(e){ /* カレンダーが読めなくても記録は使える */ }

    store.load();
    store.mergeImported(importLegacy({ base: data.history || [], meta: data }));

    // 前回取れた予定をすぐ出し、古ければ裏で取り直す
    calendar.applyCached();
    calendar.refreshIfStale().then(() => { if(view === "home" || view === "schedule") draw() });

    if(el("#remember").checked) localStorage.setItem(KEY_CODE, code);
    startApp();
  }catch(e){
    console.error(e);
    msg.textContent = "アクセスコードが違うか、データを読み込めません。";
  }
}

/* データを持たずに動かす（確認用）。本番の入口からは使わない。 */
export function startWithoutData(){
  store.load();
  startApp();
}

function boot(){
  el("#unlock").addEventListener("click", () => unlock(el("#pass").value));
  el("#pass").addEventListener("keydown", e => { if(e.key === "Enter") unlock(el("#pass").value) });
  document.querySelectorAll(".ax-nav button").forEach(b => b.addEventListener("click", () => go(b.dataset.v)));
  store.subscribe(() => { if(view !== "train") draw() });

  /* オフラインでも開けるようにする。失敗しても普通に使える。 */
  if("serviceWorker" in navigator){
    /* 置き場所ごとに受け持ちが変わるよう、HTMLから見た位置で登録する */
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }

  const saved = localStorage.getItem(KEY_CODE);
  if(saved){ el("#pass").value = saved; unlock(saved) }
}

window.axisDev = { store, go, startWithoutData, screens: { home, clients, report, schedule, history, train } };
boot();
