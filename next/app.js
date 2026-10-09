/* AXIS v2 起動と画面の切り替え。
   ここは繋ぐだけ。画面の中身は screens/ が持つ。 */

import * as archive from "./core/archive.js?v=15";
import * as store from "./core/store.js?v=14";
import { el } from "./ui/dom.js?v=14";
import * as home from "./screens/home.js?v=14";
import * as clients from "./screens/clients.js?v=16";
import * as report from "./screens/report.js?v=16";
import * as schedule from "./screens/schedule.js?v=14";
import * as history from "./screens/history.js?v=15";
import * as train from "./screens/train.js?v=14";
import * as settings from "./screens/settings.js?v=15";
import * as calendar from "./features/calendar.js?v=14";

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
  if(name === "schedule") calendar.refreshIfStale().then(() => { if(view === "schedule") draw() });
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
  if(!String(code || "").trim()){ msg.textContent = "アクセスコードを入れてください。"; return }
  msg.textContent = "読み込んでいます…";
  try{
    await archive.load(code, { remember: el("#remember").checked });
    afterOpen();
  }catch(e){
    console.error(e);
    msg.textContent = "アクセスコードが違うか、データを読み込めません。";
  }
}

/* コードが分からないときでも、この端末に入っている記録だけで使えるようにする。
   data.enc は暗号化されたままなので、過去の記録はあとからコードを入れれば足せる。 */
function openWithoutCode(){
  archive.loadLocalOnly();
  afterOpen();
}

function afterOpen(){
  calendar.applyCached();
  calendar.refreshIfStale().then(() => { if(view === "home" || view === "schedule") draw() });
  startApp();
}

/* データを持たずに動かす（確認用）。本番の入口からは使わない。 */
export function startWithoutData(){
  store.load();
  startApp();
}

function boot(){
  if(/[#&]axissync=/.test(location.hash)){
    const link = location.hash;
    window.history.replaceState(null, "", location.pathname + location.search);
    try{ calendar.importSetupLink(link) }
    catch(e){ alert(e.message) }
  }

  /* 先に、この端末に保存されている記録を読む。取り込みはこのあと足す形になる。 */
  store.load();

  el("#unlock").addEventListener("click", () => unlock(el("#pass").value));
  el("#pass").addEventListener("keydown", e => { if(e.key === "Enter") unlock(el("#pass").value) });
  el("#skip").addEventListener("click", openWithoutCode);
  document.querySelectorAll(".ax-nav button").forEach(b => b.addEventListener("click", () => go(b.dataset.v)));
  store.subscribe(() => { if(view !== "train") draw() });

  /* オフラインでも開けるようにする。失敗しても普通に使える。 */
  if("serviceWorker" in navigator){
    /* 置き場所ごとに受け持ちが変わるよう、HTMLから見た位置で登録する */
    const hadController = !!navigator.serviceWorker.controller;
    let swReloading = false;
    if(hadController){
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if(swReloading) return;
        swReloading = true;
        location.reload();
      });
    }
    navigator.serviceWorker.register("sw.js", { updateViaCache: "none" })
      .then(reg => reg.update().catch(() => {}))
      .catch(() => {});
  }

  const saved = archive.savedCode();
  if(saved){ el("#pass").value = saved; unlock(saved) }
}

window.axisDev = { store, go, startWithoutData, archive, openWithoutCode, screens: { home, clients, report, schedule, history, train } };
boot();
