/* 利用者。一覧と、1人ぶんの詳細。 */

import * as store from "../core/store.js?v=21";
import { clientSummary, deltaText, nextTargets, volumeTrend } from "../core/stats.js?v=21";
import { musclesOfSession } from "../core/muscles.js?v=21";
import { clientAdvice } from "../features/coaching.js?v=21";
import { lineMessage } from "../features/line-text.js?v=22";
import { el, esc } from "../ui/dom.js?v=21";
import { muscleMap } from "../ui/muscle-map.js?v=21";

let query = "";
let currentId = "";
let go = () => {};
export function setRouter(fn){ go = fn }
export function setCurrent(id){ currentId = id }

/* ---- 一覧 ---- */
export function renderList(){
  const root = el("#view-clients");
  if(!root) return;
  const q = query.trim();
  const list = store.clients().filter(c => !q || c.name.includes(q));

  root.innerHTML =
    '<div class="cl-title"><div><span class="ax-eyebrow">CLIENTS</span><h2>利用者</h2></div>' +
      '<button class="ax-btn" data-act="add">＋ 追加</button></div>' +
    '<input id="cl-q" class="ax-input cl-search" placeholder="名前で探す" value="' + esc(query) + '">' +
    (list.length ? '<div class="cl-grid">' + list.map(c => {
      const s = clientSummary(c.id);
      return '<button type="button" class="cl-card" data-act="open" data-id="' + esc(c.id) + '">' +
        '<b>' + esc(c.name) + '</b>' +
        '<span>' + (s.count ? s.count + "回 · 最終 " + esc(s.lastDate) : "記録なし") + '</span>' +
      '</button>';
    }).join("") + '</div>' : '<div class="ax-empty">利用者がいません</div>');

  root.onclick = ev => {
    const t = ev.target.closest("[data-act]");
    if(!t) return;
    if(t.dataset.act === "open") go("client", t.dataset.id);
    if(t.dataset.act === "add") addClient();
  };
  el("#cl-q").oninput = e => { query = e.target.value; renderList(); el("#cl-q").focus() };
}

function addClient(){
  const name = prompt("利用者の名前");
  if(!name || !name.trim()) return;
  const c = store.upsertClient({ name: name.trim(), goal: "", attention: "", active: true });
  go("client", c.id);
}

/* ---- 詳細 ---- */
function bars(trend){
  const max = Math.max(...trend.map(x => x.value), 1);
  if(!trend.length) return '<div class="ax-empty">まだ記録がありません</div>';
  return '<div class="cd-bars">' + trend.map(x =>
    '<div class="cd-bar"><i style="height:' + Math.max(6, Math.round(x.value / max * 100)) + '%"></i>' +
    '<span>' + esc(x.date.slice(5).replace("-", "/")) + '</span></div>'
  ).join("") + '</div>';
}

export function renderDetail(){
  const root = el("#view-client");
  const c = store.client(currentId);
  if(!root) return;
  if(!c){ go("clients"); return }

  const s = clientSummary(c.id);
  const list = store.sessions({ clientId: c.id });
  const muscles = s.last ? musclesOfSession(s.last) : [];
  const targets = nextTargets(c.id);
  const partner = c.partnerId ? store.client(c.partnerId) : null;

  root.innerHTML =
    '<div class="cd-head">' +
      '<button type="button" class="cd-back" data-act="back" aria-label="戻る">‹</button>' +
      '<div><span class="ax-eyebrow">CLIENT</span><h2>' + esc(c.name) + '</h2>' +
        '<p>' + esc(c.goal || "目標は未登録") + '</p></div>' +
      '<button type="button" class="ax-btn ghost cd-edit" data-act="edit">編集</button>' +
    '</div>' +

    '<div class="cd-actions">' +
      '<button class="ax-btn pri" data-act="start">直近メニューで開始</button>' +
      '<button class="ax-btn" data-act="report"' + (s.last ? "" : " disabled") + '>本人向けまとめ</button>' +
    '</div>' +

    (c.attention ? '<div class="cd-attention"><b>注意点</b>' + esc(c.attention) + '</div>' : "") +

    (partner ? '<div class="cd-pair">' +
      '<div><b>ペアトレ' + (c.pairLabel ? '　' + esc(c.pairLabel) : '') + '</b><span>相手：' + esc(partner.name) + '</span></div>' +
      (c.pairLabel ? '' : '<button type="button" class="ax-btn ghost" data-act="pair">変える</button>') +
    '</div>' : '') +

    (targets.length
      ? '<section class="ax-panel cd-panel-next"><div class="cd-h cd-h-split"><span>次回の目安</span><small>NEXT SESSION</small></div>' +
        '<ul class="cd-next">' + targets.map(t => '<li><b>' + esc(t.name) + '</b>' + esc(t.text) + '</li>').join("") + '</ul></section>'
      : "") +

    '<div class="cd-kpis">' +
      '<div><b>' + s.count + '</b><span>トレーニング回数</span></div>' +
      '<div><b>' + s.volume.toLocaleString() + '</b><span>直近の総負荷 kg</span></div>' +
      '<div><b>' + esc(deltaText(s.delta)) + '</b><span>前回比</span></div>' +
    '</div>' +

    '<section class="ax-panel cd-panel-trend"><div class="cd-h">総負荷の推移</div>' + bars(volumeTrend(c.id)) + '</section>' +

    (muscles.length
      ? '<section class="ax-panel cd-panel-muscle"><div class="cd-h">直近で鍛えた部位</div>' + muscleMap(s.last) + '</section>'
      : "") +

    (s.last
      ? '<section class="ax-panel cd-line cd-panel-line">' +
          '<div class="cd-h">LINE文面</div>' +
          '<p class="cd-linenote">直して使えます。コピーしてLINEに貼ってください。</p>' +
          '<textarea id="cd-linetext" class="ax-area cd-linebox">' + esc(lineMessage(c.id)) + '</textarea>' +
          '<div class="cd-lineacts">' +
            '<button class="ax-btn pri" data-act="copy-line">コピー</button>' +
            '<button class="ax-btn" data-act="redo-line">作り直す</button>' +
          '</div>' +
        '</section>' +

        '<section class="ax-panel"><div class="cd-h">今日のポイント</div>' +
          '<ul class="cd-advice">' +
            clientAdvice(c.id).map(a =>
              '<li class="lv-' + esc(a.level) + '"><i>' + esc(label(a.level)) + '</i>' + esc(a.text) + '</li>'
            ).join("") +
          '</ul>' +
        '</section>'
      : "") +

    '<div class="cd-h cd-listh">これまでの記録<span>' + list.length + '件</span></div>' +
    (list.length
      ? list.slice(0, 6).map(x =>
          '<button type="button" class="cd-rec" data-act="edit-session" data-id="' + esc(x.id) + '">' +
            '<b>' + esc(x.date) + '</b>' +
            '<span>' + x.exercises.map(e => esc(e.name)).slice(0, 3).join("、") + (x.exercises.length > 3 ? " ほか" : "") + '</span>' +
          '</button>').join("")
      : '<div class="ax-empty">記録がありません</div>');

  root.onclick = ev => {
    const t = ev.target.closest("[data-act]");
    if(!t) return;
    switch(t.dataset.act){
      case "back":    go("clients"); break;
      case "start":   go("train-from", c.id); break;
      case "report":  go("report", c.id); break;
      case "edit":    editClient(c); break;
      case "pair":    choosePartner(c); break;
      case "edit-session": go("train-session", t.dataset.id); break;
      case "copy-line":  copyLine(); break;
      case "redo-line":  renderDetail(); break;
    }
  };
}

const LEVELS = { safety:"安全", load:"負荷", progress:"伸ばし方", balance:"バランス", goal:"目標", habit:"頻度" };
const label = lv => LEVELS[lv] || "メモ";

/* ペアトレの相手を決める。夫婦など、同じ時間に来て別の種目をやる2人を結びつける。 */
function choosePartner(c){
  const others = store.clients().filter(x => x.id !== c.id);
  if(!others.length){ alert("ほかに利用者が登録されていません。"); return }
  const cur = c.partnerId ? others.findIndex(x => x.id === c.partnerId) + 1 : 0;
  const lines = others.map((x, i) => (i + 1) + ". " + x.name + (x.id === c.partnerId ? "  ←いまの相手" : "")).join("\n");
  const ans = prompt(
    "一緒に記録する相手の番号を入れてください。\n" +
    "0 で設定を外します。\n" +
    "名前を入力すると、その人を新しく登録して相手にします。\n\n" + lines, String(cur));
  if(ans === null) return;

  const typed = String(ans).trim();
  const n = Number(typed);
  /* 数字でなければ新しい利用者の名前として扱う */
  if(typed && !/^\d+$/.test(typed)){
    const mate = store.upsertClient({ name: typed, goal: "", attention: "", active: true });
    link(c, mate);
    renderDetail();
    return;
  }
  if(!Number.isFinite(n) || n < 0 || n > others.length){ alert("番号が正しくありません。"); return }

  if(n === 0) link(c, null);
  else link(c, others[n - 1]);
  renderDetail();
}

/* 相手にも同じ結びつきを入れる。片方だけだと切り替えが出ない。 */
function link(c, mate){
  if(c.partnerId){
    const old = store.client(c.partnerId);
    if(old && old.partnerId === c.id) store.upsertClient({ ...old, partnerId: "" });
  }
  if(!mate){ store.upsertClient({ ...c, partnerId: "" }); return }
  store.upsertClient({ ...c, partnerId: mate.id });
  store.upsertClient({ ...mate, partnerId: c.id });
}

async function copyLine(){
  const box = el("#cd-linetext");
  if(!box) return;
  const btn = document.querySelector('[data-act="copy-line"]');
  const label = btn?.textContent;
  try{
    await navigator.clipboard.writeText(box.value);
  }catch(e){
    /* クリップボードが使えない端末向け。選択状態にして手でコピーしてもらう。 */
    box.focus();
    box.select();
    try{ document.execCommand("copy") }catch(e2){}
  }
  if(btn){
    btn.textContent = "コピーしました";
    setTimeout(() => { btn.textContent = label }, 1600);
  }
}

function editClient(c){
  const name = prompt("名前", c.name);
  if(name === null) return;
  const goal = prompt("目標", c.goal || "");
  if(goal === null) return;
  const attention = prompt("注意点（トレーナー用。本人向けまとめには出しません）", c.attention || "");
  if(attention === null) return;
  store.upsertClient({ ...c, name: name.trim() || c.name, goal, attention });
  renderDetail();
}
