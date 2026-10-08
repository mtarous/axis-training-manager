/* 予定。カレンダーの取り込み済みスナップショットを並べ、不要な予定は端末ごとに隠せる。 */

import * as calendar from "../features/calendar.js?v=10";
import { getMeta } from "../core/meta.js";
import * as sched from "../core/schedule.js";
import { today } from "../core/model.js";
import { el, esc } from "../ui/dom.js";

let go = () => {};
export function setRouter(fn){ go = fn }

const jp = d => {
  const x = new Date(String(d).slice(0, 10) + "T00:00:00+09:00");
  return Number.isNaN(x.getTime()) ? d
    : x.toLocaleDateString("ja-JP", { month: "long", day: "numeric", weekday: "short" });
};

export function render(){
  const root = el("#view-schedule");
  if(!root) return;

  const t = today();
  const list = sched.all().filter(x => x.date >= t);
  const days = [...new Set(list.map(x => x.date))];
  const hidden = sched.hiddenItems();

  root.innerHTML =
    '<div class="sc-title"><span class="ax-eyebrow">SCHEDULE</span><h2>予定</h2>' +
      (sched.syncedAt() ? '<p>カレンダー取込 ' + esc(sched.syncedAt()) + '</p>' : '<p>カレンダーの取り込みはまだありません</p>') +
    '</div>' +
    '<div class="se-grid" style="margin-bottom:12px">' +
      '<button class="ax-btn" data-act="refresh">予定を更新</button>' +
      '<button class="ax-btn" data-act="settings">カレンダー設定</button>' +
    '</div>' +
    (!calendar.isConfigured() ? '<p class="se-note">Googleカレンダーは未接続です。「カレンダー設定」から接続してください。</p>' : '') +
    (getMeta().calendarLoadError ? '<p class="se-note" role="alert">更新できませんでした：' + esc(getMeta().calendarLoadError) + '</p>' : '') +

    (hidden.length
      ? '<details class="ax-panel sc-hidden"><summary>非表示にした予定 <b>' + hidden.length + '件</b></summary>' +
        '<div class="sc-hiddenbody">' +
          hidden.map(x => '<div class="sc-hiddenrow"><div><b>' + esc(x.label) + '</b><span>' + esc(x.date) + ' ' + esc(x.time) + '</span></div>' +
            '<button type="button" class="ax-btn" data-act="restore" data-k="' + esc(sched.keyOf(x)) + '">戻す</button></div>').join("") +
          '<button type="button" class="ax-btn full" data-act="restoreall">ぜんぶ戻す</button>' +
        '</div></details>'
      : "") +

    (days.length ? days.map(d =>
      '<div class="sc-day">' + esc(jp(d)) + (d === t ? '<i>今日</i>' : "") + '</div>' +
      list.filter(x => x.date === d).map(x =>
        '<div class="sc-item' + (x.clientId ? " linked" : "") + '">' +
          '<span class="sc-time">' + esc(x.time || "--:--") + '</span>' +
          '<button type="button" class="sc-main" data-act="open" data-id="' + esc(x.clientId) + '">' +
            '<b>' + esc(x.label) + '</b><i>' + esc(x.type) + (x.calendar ? " · カレンダー" : "") + '</i>' +
          '</button>' +
          '<button type="button" class="sc-hide" data-act="hide" data-k="' + esc(sched.keyOf(x)) + '" aria-label="この予定を隠す">×</button>' +
        '</div>').join("")
    ).join("") : '<div class="ax-empty">これからの予定はありません</div>');

  root.onclick = ev => {
    const b = ev.target.closest("[data-act]");
    if(!b) return;
    if(b.dataset.act === "settings") go("settings");
    if(b.dataset.act === "refresh"){
      b.disabled = true;
      b.textContent = "取得中…";
      calendar.refresh().then(() => render()).catch(e => {
        alert(String(e.message || e));
        b.disabled = false;
        b.textContent = "予定を更新";
      });
    }
    if(b.dataset.act === "open" && b.dataset.id) go("client", b.dataset.id);
    if(b.dataset.act === "hide"){ sched.hide(b.dataset.k); render() }
    if(b.dataset.act === "restore"){ sched.restore(b.dataset.k); render() }
    if(b.dataset.act === "restoreall"){ sched.restoreAll(); render() }
  };
}
