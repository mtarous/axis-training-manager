/* 休憩タイマー。画面下に出し、一時停止・延長・停止ができる。 */

import { dock, el } from "./dom.js?v=18";

let left = 0, total = 0, tick = null, running = false;

const mmss = s => Math.floor(Math.max(0, s) / 60) + ":" + String(Math.floor(Math.max(0, s) % 60)).padStart(2, "0");

function bar(){
  let b = el("#ax-rest");
  if(b) return b;
  b = document.createElement("div");
  b.id = "ax-rest";
  b.className = "ax-bar ax-rest";
  b.innerHTML =
    '<div class="ax-rest-head">' +
      '<b id="ax-rest-time">0:00</b>' +
      '<span id="ax-rest-state">休憩中</span>' +
      '<div class="ax-rest-track"><i id="ax-rest-fill"></i></div>' +
    '</div>' +
    '<div class="ax-rest-btns">' +
      '<button type="button" id="ax-rest-pause" class="ax-rest-main">一時停止</button>' +
      '<button type="button" id="ax-rest-plus">＋30秒</button>' +
      '<button type="button" id="ax-rest-stop" class="ax-rest-stop">停止</button>' +
    '</div>';
  dock().appendChild(b);
  b.querySelector("#ax-rest-pause").addEventListener("click", toggle);
  b.querySelector("#ax-rest-plus").addEventListener("click", () => add(30));
  b.querySelector("#ax-rest-stop").addEventListener("click", stop);
  return b;
}

function paint(){
  const b = bar();
  b.hidden = false;
  b.classList.toggle("paused", !running);
  b.classList.toggle("zero", left <= 0);
  document.body.classList.add("ax-resting");
  el("#ax-rest-time").textContent  = mmss(left);
  el("#ax-rest-state").textContent = left <= 0 ? "休憩おわり" : (running ? "休憩中" : "一時停止中");
  el("#ax-rest-fill").style.width  = (total > 0 ? Math.max(0, Math.min(100, left / total * 100)) : 0) + "%";
  el("#ax-rest-pause").textContent = running ? "一時停止" : "再開";
}

function clear(){ if(tick){ clearInterval(tick); tick = null } }

function step(){
  left -= 1;
  if(left <= 0){
    left = 0;
    running = false;
    clear();
    if(navigator.vibrate) navigator.vibrate([200, 100, 200]);
  }
  paint();
}

export function start(seconds){
  clear();
  total = Math.max(1, Math.round(seconds) || 60);
  left = total;
  running = true;
  paint();
  tick = setInterval(step, 1000);
}
export function toggle(){
  if(left <= 0){ start(total || 60); return }
  running = !running;
  clear();
  if(running) tick = setInterval(step, 1000);
  paint();
}
export function add(seconds){
  if(left <= 0 && seconds < 0) return;
  left = Math.max(0, left + seconds);
  total = Math.max(total, left);
  paint();
}
export function stop(){
  clear();
  running = false;
  left = 0;
  total = 0;
  const b = el("#ax-rest");
  if(b) b.hidden = true;
  document.body.classList.remove("ax-resting");
}

/* 種目に合わせた休憩の目安。多関節は長め、補助種目は短め。 */
const COMPOUND = ["スクワット","デッドリフト","ベンチ","プレス","ロウ","懸垂","チンニング","ランジ","クリーン","ディップス","プルダウン"];
export function suggestSeconds(exerciseName, reps){
  const name = String(exerciseName || "");
  const heavy = COMPOUND.some(k => name.includes(k));
  const r = Number(reps) || 10;
  if(heavy) return r <= 6 ? 180 : r <= 10 ? 120 : 90;
  return r <= 10 ? 75 : 60;
}
