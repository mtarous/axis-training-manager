/* ホーム。今日やることと、記録への入口だけを出す。 */

import * as store from "../core/store.js";
import * as schedule from "../core/schedule.js";
import { today } from "../core/model.js";
import { el, esc } from "../ui/dom.js";

let go = () => {};
export function setRouter(fn){ go = fn }

const jp = d => {
  const x = new Date(String(d).slice(0, 10) + "T00:00:00+09:00");
  return Number.isNaN(x.getTime()) ? d
    : x.toLocaleDateString("ja-JP", { month: "long", day: "numeric", weekday: "short" });
};

function item(s){
  return '<button type="button" class="ho-item" data-act="open" data-id="' + esc(s.clientId) + '">' +
    '<span class="ho-time">' + esc(s.time || "--:--") + '</span>' +
    '<span class="ho-label"><b>' + esc(s.label) + '</b>' +
      '<i>' + esc(s.type) + (s.calendar ? " · カレンダー" : "") + '</i></span>' +
    (s.clientId ? '<span class="ho-go">›</span>' : "") +
  '</button>';
}

export function render(){
  const root = el("#view-home");
  if(!root) return;

  const t = today();
  const list = schedule.all();
  const todays = list.filter(x => x.date === t);
  const upcoming = list.filter(x => x.date > t).slice(0, 4);
  const month = t.slice(0, 7);
  const thisMonth = store.sessions().filter(s => s.date.startsWith(month)).length;
  const synced = schedule.syncedAt();

  root.innerHTML =
    '<section class="ho-hero">' +
      '<button type="button" class="ho-gear" data-act="settings" aria-label="設定">⚙</button>' +
      '<span class="ax-eyebrow">TODAY</span>' +
      '<h2>' + esc(jp(t)) + '</h2>' +
      '<p>' + (todays.length ? "今日は " + todays.length + "件の予定があります" : "今日の予定はありません") + '</p>' +
    '</section>' +

    '<button class="ax-btn pri full ho-start" data-act="train">＋ 記録をはじめる</button>' +

    '<div class="ho-kpis">' +
      '<div><b>' + store.clients().length + '</b><span>利用者</span></div>' +
      '<div><b>' + thisMonth + '</b><span>今月の記録</span></div>' +
      '<div><b>' + store.sessions().length + '</b><span>記録ぜんぶ</span></div>' +
    '</div>' +

    '<div class="ho-title"><h3>今日の予定</h3>' +
      (list.length ? '<button type="button" class="ho-more" data-act="schedule">予定をぜんぶ見る</button>' : "") +
    '</div>' +
    (todays.length ? todays.map(item).join("") : '<div class="ax-empty">予定はありません</div>') +

    (!todays.length && upcoming.length
      ? '<div class="ho-title"><h3>このあと</h3></div>' + upcoming.map(item).join("")
      : "") +

    (synced ? '<p class="ho-synced">カレンダー取込 ' + esc(synced) + '</p>' : "");

  root.onclick = ev => {
    const t2 = ev.target.closest("[data-act]");
    if(!t2) return;
    if(t2.dataset.act === "train") go("train");
    if(t2.dataset.act === "schedule") go("schedule");
    if(t2.dataset.act === "settings") go("settings");
    if(t2.dataset.act === "open" && t2.dataset.id) go("client", t2.dataset.id);
  };
}
