/* 本人向けのまとめ。画面を見せる前提なので、トレーナー用の注意点は出さない。 */

import * as store from "../core/store.js?v=14";
import { clientSummary, deltaText } from "../core/stats.js?v=14";
import { musclesOfSession } from "../core/muscles.js?v=14";
import { summarizeSets } from "../core/model.js?v=14";
import { el, esc } from "../ui/dom.js?v=14";
import { muscleMap } from "../ui/muscle-map.js?v=1";

/* 名前にすでに敬称が付いていれば足さない */
const honorific = name => /(さん|様|さま|氏)\s*$/.test(String(name)) ? "" : " さま";

let currentId = "";
let go = () => {};
export function setRouter(fn){ go = fn }
export function setCurrent(id){ currentId = id }

const jp = d => {
  const x = new Date(String(d).slice(0, 10) + "T00:00:00+09:00");
  return Number.isNaN(x.getTime()) ? d : x.toLocaleDateString("ja-JP", { year:"numeric", month:"long", day:"numeric" });
};

export function render(){
  const root = el("#view-report");
  const c = store.client(currentId);
  if(!root) return;
  if(!c){ go("clients"); return }

  const s = clientSummary(c.id);
  const last = s.last;
  if(!last){
    root.innerHTML = '<div class="ax-empty">まだ記録がありません</div>';
    return;
  }
  const muscles = musclesOfSession(last);

  root.innerHTML =
    '<div class="rp-bar">' +
      '<button type="button" class="ax-btn ghost" data-act="back">‹ 戻る</button>' +
      '<span>この画面をそのままお見せできます</span>' +
    '</div>' +

    '<article class="rp-sheet">' +
      '<header class="rp-head">' +
        '<div class="rp-logo">A<i>X</i>IS<small>TRAINING</small></div>' +
        '<div class="rp-date"><span>DATE</span><b>' + esc(jp(last.date)) + '</b></div>' +
      '</header>' +

      '<div class="rp-name"><span class="ax-eyebrow">CLIENT</span><h2>' + esc(c.name) + honorific(c.name) + '</h2>' +
        (c.goal ? '<p>' + esc(c.goal) + '</p>' : "") + '</div>' +

      '<div class="rp-kpis">' +
        '<div><span>総負荷</span><b>' + s.volume.toLocaleString() + '<small>kg</small></b></div>' +
        '<div><span>前回比</span><b>' + esc(deltaText(s.delta)) + '</b></div>' +
        '<div><span>セット</span><b>' + s.sets + '</b></div>' +
      '</div>' +

      '<section class="rp-block"><h3>今日のメニュー</h3>' +
        last.exercises.map(e =>
          '<div class="rp-row"><b>' + esc(e.name) + '</b><span>' + esc(summarizeSets(e.sets)) + '</span></div>'
        ).join("") +
      '</section>' +

      (muscles.length
        ? '<section class="rp-block"><h3>鍛えた部位</h3>' + muscleMap(last) + '</section>'
        : "") +

      (last.notes.insight
        ? '<section class="rp-block"><h3>今日のご様子</h3><p>' + esc(last.notes.insight) + '</p></section>' : "") +

      (last.notes.share
        ? '<section class="rp-block"><h3>お伝えしたいこと</h3><p>' + esc(last.notes.share) + '</p></section>' : "") +

      (last.notes.next
        ? '<section class="rp-block"><h3>次回に向けて</h3><p>' + esc(last.notes.next) + '</p></section>' : "") +

      '<footer class="rp-foot">AXIS PERSONAL TRAINING</footer>' +
    '</article>';

  root.onclick = ev => {
    if(ev.target.closest('[data-act="back"]')) go("client", c.id);
  };
}
