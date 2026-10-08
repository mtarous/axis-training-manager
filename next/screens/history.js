/* 履歴。セッション単位で見て、直して、消す。 */

import * as store from "../core/store.js?v=14";
import { sessionSetCount, sessionVolume, summarizeSets } from "../core/model.js?v=14";
import { el, esc, toast } from "../ui/dom.js?v=14";

const PAGE = 30;

let query = "";
let shown = PAGE;
let typing = null;
let onEdit = () => {};

export function setEditHandler(fn){ onEdit = fn }

function card(s){
  const name = store.clientName(s.clientId) || "（利用者なし）";
  return '<section class="ax-panel hi-card">' +
    '<div class="hi-head">' +
      '<div><b>' + esc(s.date) + '</b><span>' + esc(name) + '</span></div>' +
      '<div class="hi-acts">' +
        '<button type="button" class="ax-btn ghost" data-act="edit" data-id="' + esc(s.id) + '">直す</button>' +
        '<button type="button" class="ax-btn ghost danger" data-act="del" data-id="' + esc(s.id) + '">削除</button>' +
      '</div>' +
    '</div>' +
    '<div class="hi-meta">' +
      '<span>' + s.exercises.length + '種目</span>' +
      '<span>' + sessionSetCount(s) + 'セット</span>' +
      '<span>総負荷 ' + Math.round(sessionVolume(s)).toLocaleString() + 'kg</span>' +
      (s.source === "legacy" ? '<span class="hi-legacy">既存記録</span>' : "") +
      (Array.isArray(s.notesAuto) && s.notesAuto.length
        ? '<span class="hi-auto">メモ自動記入</span>' : "") +
    '</div>' +
    '<div class="hi-rows">' +
      s.exercises.map(e =>
        '<div class="hi-row"><b>' + esc(e.name || "（種目名なし）") + '</b><span>' + esc(summarizeSets(e.sets)) + '</span></div>'
      ).join("") +
    '</div>' +
    (s.notes.insight || s.notes.next
      ? '<div class="hi-note">' +
          (s.notes.insight ? '<p><i>気づき</i>' + esc(s.notes.insight) + '</p>' : "") +
          (s.notes.next ? '<p><i>次回</i>' + esc(s.notes.next) + '</p>' : "") +
        '</div>'
      : "") +
  '</section>';
}

function trashPanel(){
  const items = store.trash();
  if(!items.length) return "";
  return '<details class="ax-panel hi-trash">' +
    '<summary>ゴミ箱 <b>' + items.length + '件</b><small>30日で自動的に消えます</small></summary>' +
    '<div class="hi-trashbody">' +
      items.map(s =>
        '<div class="hi-trashrow">' +
          '<div><b>' + esc(s.date) + '｜' + esc(store.clientName(s.clientId)) + '</b><span>' + s.exercises.length + '種目</span></div>' +
          '<button type="button" class="ax-btn" data-act="restore" data-id="' + esc(s.id) + '">戻す</button>' +
        '</div>').join("") +
      '<button type="button" class="ax-btn danger full" data-act="empty">ゴミ箱を空にする</button>' +
    '</div></details>';
}

export function render(){
  const root = el("#view-history");
  if(!root) return;

  const q = query.trim();
  const list = store.sessions().filter(s => {
    if(!q) return true;
    return (store.clientName(s.clientId) || "").includes(q) ||
           s.exercises.some(e => e.name.includes(q));
  });

  root.innerHTML =
    '<div class="hi-title"><span class="ax-eyebrow">HISTORY</span><h2>記録</h2></div>' +
    trashPanel() +
    '<input id="hi-q" class="ax-input hi-search" placeholder="利用者・種目で探す" value="' + esc(query) + '">' +
    (list.length
      ? list.slice(0, shown).map(card).join("") +
        (list.length > shown
          ? '<button type="button" class="ax-btn full hi-more" data-act="more">もっと見る（残り ' + (list.length - shown) + '件）</button>'
          : "")
      : '<div class="ax-empty">記録がありません</div>');

  root.onclick = ev => {
    const t = ev.target.closest("[data-act]");
    if(!t) return;
    const id = t.dataset.id;
    if(t.dataset.act === "more"){ shown += PAGE; render(); return }
    if(t.dataset.act === "edit"){ onEdit(id); return }
    if(t.dataset.act === "del"){ remove(id); return }
    if(t.dataset.act === "restore"){ store.restoreSession(id); render(); return }
    if(t.dataset.act === "empty"){
      if(confirm("ゴミ箱の記録を完全に削除しますか？\n\nこの操作は元に戻せません。")) { store.emptyTrash(); render() }
    }
  };
  const box = el("#hi-q");
  /* 1文字ごとに全件描き直すと、打っている最中に固まる。入力が止まってから描く。 */
  box.oninput = e => {
    query = e.target.value;
    shown = PAGE;
    clearTimeout(typing);
    typing = setTimeout(() => {
      render();
      const again = el("#hi-q");
      if(again){ again.focus(); again.setSelectionRange(again.value.length, again.value.length) }
    }, 180);
  };
}

function remove(id){
  const s = store.session(id);
  if(!s) return;
  const label = s.date + "｜" + store.clientName(s.clientId);
  store.deleteSession(id);
  render();
  toast("削除しました", {
    detail: label + "（30日間はゴミ箱から戻せます）",
    actionLabel: "取り消す",
    onAction: () => { store.restoreSession(id); render() }
  });
}
