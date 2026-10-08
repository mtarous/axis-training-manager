/* 設定。書き出しと、カレンダーの接続先。 */

import * as store from "../core/store.js";
import { expandToRows } from "../core/model.js";
import * as archive from "../core/archive.js";
import * as calendar from "../features/calendar.js?v=11";
import { countEmpty, fillEmptyNotes } from "../features/notes-fill.js";
import { buildPlainWorkbook, buildSubmitWorkbook, saveWorkbook } from "../features/excel.js";
import { el, esc, toast } from "../ui/dom.js";

let go = () => {};
export function setRouter(fn){ go = fn }

/* 以前のアプリはリポジトリの一番上にある。どの階層から開かれても届くようにする。 */
const legacyURL = () => new URL("../../legacy.html", import.meta.url).href;

/* v2の記録を「1行=1種目」の表に開く */
function rows(){
  return store.sessions()
    .flatMap(s => expandToRows(s, store.clientName(s.clientId)))
    .filter(r => r.client && r.exercise);
}

export function render(){
  const root = el("#view-settings");
  if(!root) return;

  const cal = calendar.settings();
  const trash = store.trash().length;
  const empty = countEmpty(store.getState().sessions);

  root.innerHTML =
    '<div class="se-head">' +
      '<button type="button" class="se-back" data-act="back" aria-label="戻る">‹</button>' +
      '<div><span class="ax-eyebrow">SETTINGS</span><h2>設定</h2></div>' +
    '</div>' +

    (archive.savedCode()
      ? ""
      : '<section class="ax-panel se-archive">' +
          '<div class="se-h">過去の記録を読み込む</div>' +
          '<p class="se-note">元のExcelから取り込んだ過去の記録は、アクセスコードを入れると出てきます。' +
            'この端末に入力した記録は、コード無しでもそのまま使えています。</p>' +
          '<label class="ax-field"><span>アクセスコード</span>' +
            '<input id="se-code" class="ax-input" type="password" autocomplete="current-password"></label>' +
          '<button class="ax-btn pri full se-mt" data-act="load-archive">読み込む</button>' +
          '<div id="se-codemsg" class="se-note se-mt"></div>' +
        '</section>') +

    (empty
      ? '<section class="ax-panel">' +
          '<div class="se-h">メニューから注意点などを記入する</div>' +
          '<p class="se-note">空いている「注意点」「共有事項」「次回やること」を、その回の種目から埋めます。' +
            'すでに書かれているものは書き換えません。' +
            'その日の様子である「気づき」は、見ていないことを書くことになるので作りません。</p>' +
          '<button class="ax-btn pri full" data-act="fill-notes">' + empty + '件に記入する</button>' +
        '</section>'
      : "") +

    '<section class="ax-panel">' +
      '<div class="se-h">Excelに書き出す</div>' +
      '<p class="se-note">提出用は、元の「トレーニング管理」と同じ7シート構成で出します。</p>' +
      '<div class="se-grid">' +
        '<button class="ax-btn pri full" data-act="excel-submit">提出用Excel（7シート）</button>' +
        '<button class="ax-btn full" data-act="excel-plain">記録だけのExcel</button>' +
      '</div>' +
    '</section>' +

    '<section class="ax-panel">' +
      '<div class="se-h">バックアップ</div>' +
      '<p class="se-note">記録はこの端末の中にあります。機種変更の前や、念のための控えに。</p>' +
      '<div class="se-grid">' +
        '<button class="ax-btn full" data-act="backup-save">ファイルに書き出す</button>' +
        '<button class="ax-btn full" data-act="backup-load">ファイルから読み込む</button>' +
      '</div>' +
      '<input id="se-file" type="file" accept="application/json" hidden>' +
    '</section>' +

    '<section class="ax-panel">' +
      '<div class="se-h">Googleカレンダー</div>' +
      '<p class="se-note">接続すると、予定をその場で読み直せます。未設定でも、取り込み済みの予定は見られます。</p>' +
       '<label class="ax-field"><span>メールの設定リンク</span>' +
        '<textarea id="se-setup-link" class="ax-input" rows="2" placeholder="設定リンクをここに貼り付け" spellcheck="false"></textarea></label>' +
      '<p class="se-note">ホーム画面のアプリでは、メールのリンクをコピーしてここに貼り付けてください。</p>' +
      '<button class="ax-btn pri full" data-act="cal-link">リンクで接続して予定を取り込む</button>' +
      '<label class="ax-field se-mt"><span>接続先のURL</span>' +
        '<input id="se-endpoint" class="ax-input" placeholder="https://script.google.com/macros/s/.../exec" value="' + esc(cal.endpoint) + '"></label>' +
      '<label class="ax-field se-mt"><span>トークン</span>' +
        '<input id="se-token" class="ax-input" type="password" placeholder="Apps Scriptで決めた合い言葉" value="' + esc(cal.token) + '"></label>' +
      (cal.calendarId ? '<p class="se-note se-mt">読み込むカレンダー：' + esc(cal.calendarId) + '</p>' : "") +
      '<div class="se-grid se-mt">' +
        '<button class="ax-btn pri full" data-act="cal-save">接続先を保存</button>' +
        '<button class="ax-btn" data-act="cal-refresh"' + (calendar.isConfigured() ? "" : " disabled") + '>いま取り込む</button>' +
        '<button class="ax-btn" data-act="cal-choose"' + (calendar.isConfigured() ? "" : " disabled") + '>カレンダーを選ぶ</button>' +
      '</div>' +
    '</section>' +

    '<section class="ax-panel">' +
      '<div class="se-h">以前のアプリ</div>' +
      '<p class="se-note">作り直す前の画面も残してあります。記録は同じものを見ています。</p>' +
      '<a class="ax-btn full se-link" href="' + legacyURL() + '">以前のアプリを開く</a>' +
    '</section>' +

    '<section class="ax-panel">' +
      '<div class="se-h">いまのデータ</div>' +
      '<div class="se-stats">' +
        '<div><b>' + store.clients().length + '</b><span>利用者</span></div>' +
        '<div><b>' + store.sessions().length + '</b><span>記録</span></div>' +
        '<div><b>' + trash + '</b><span>ゴミ箱</span></div>' +
      '</div>' +
    '</section>';

  root.onclick = ev => {
    const t = ev.target.closest("[data-act]");
    if(!t) return;
    switch(t.dataset.act){
      case "back":          go("home"); break;
      case "excel-submit":  busy(t, exportSubmit); break;
      case "excel-plain":   busy(t, exportPlain); break;
      case "backup-save":   backupSave(); break;
      case "backup-load":   el("#se-file").click(); break;
      case "cal-link":      connectLink(t); break;
      case "cal-save":      saveCalendar(); break;
      case "cal-refresh":   refreshCalendar(t); break;
      case "cal-choose":    chooseCalendar(); break;
      case "load-archive":  loadArchive(); break;
      case "fill-notes":    busy(t, fillNotes); break;
    }
  };
  el("#se-file").onchange = backupLoad;
}

async function loadArchive(){
  const code = el("#se-code")?.value || "";
  const msg = el("#se-codemsg");
  if(!code.trim()){ msg.textContent = "アクセスコードを入れてください。"; return }
  msg.textContent = "読み込んでいます…";
  try{
    const n = await archive.load(code);
    render();
    toast(n + "件の過去の記録を読み込みました", { seconds: 6 });
  }catch(e){
    msg.textContent = "アクセスコードが違うか、データを読み込めません。";
  }
}

function fillNotes(){
  const n = store.repair(fillEmptyNotes);
  render();
  toast(n + "件に記入しました", { detail: "注意点・共有事項・次回やること", seconds: 6 });
}

/* 1000行を超えると数秒かかる。押せたことが分かるようにする。 */
function busy(btn, run){
  const label = btn.textContent;
  btn.disabled = true;
  btn.textContent = "作成中…";
  setTimeout(() => {
    try{ run() }
    finally{ btn.disabled = false; btn.textContent = label }
  }, 30);
}

function exportSubmit(){
  try{
    const clients = store.clients().map(c => ({ name: c.name, goal: c.goal || "" }));
    saveWorkbook(buildSubmitWorkbook({ rows: rows(), clients, exercises: store.exerciseNames() }), "トレーニング管理");
    toast("提出用Excelを書き出しました", { seconds: 6 });
  }catch(e){ alert(String(e.message || e)) }
}
function exportPlain(){
  try{
    saveWorkbook(buildPlainWorkbook(rows()), "AXIS記録");
    toast("Excelを書き出しました", { seconds: 6 });
  }catch(e){ alert(String(e.message || e)) }
}

function backupSave(){
  const blob = new Blob([JSON.stringify(store.exportBackup(), null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "axis_backup_" + new Date().toLocaleDateString("sv-SE") + ".json";
  a.click();
  URL.revokeObjectURL(a.href);
  toast("バックアップを書き出しました", { seconds: 6 });
}
async function backupLoad(ev){
  const file = ev.target.files?.[0];
  ev.target.value = "";
  if(!file) return;
  try{
    const n = store.importBackup(JSON.parse(await file.text()));
    render();
    toast(n + "件を読み込みました", { seconds: 6 });
  }catch(e){ alert("このファイルは読み込めません。\n\n" + String(e.message || e)) }
}

function saveCalendar(){
  calendar.saveSettings({
    endpoint: el("#se-endpoint").value.trim(),
    token: el("#se-token").value.trim()
  });
  calendar.clearCache();
  render();
  toast("接続先を保存しました", { seconds: 5 });
}
async function refreshCalendar(btn){
  const label = btn.textContent;
  btn.disabled = true;
  btn.textContent = "取得中…";
  try{
    const r = await calendar.refresh();
    toast(r.count + "件の予定を取り込みました", { seconds: 6 });
  }catch(e){ alert(String(e.message || e)) }
  btn.disabled = false;
  btn.textContent = label;
}
async function chooseCalendar(){
  try{
    const { list, defaultId } = await calendar.listCalendars();
    if(!list.length){ alert("見えるカレンダーがありませんでした。"); return }
    const cur = calendar.settings().calendarId || defaultId;
    const lines = list.map((c, i) => (i + 1) + ". " + c.name + (c.id === cur ? "  ←いま選択中" : "")).join("\n");
    const ans = prompt("読み込むカレンダーの番号を入れてください。\n\n" + lines,
      String(Math.max(1, list.findIndex(c => c.id === cur) + 1)));
    if(ans === null) return;
    const n = Number(ans);
    if(!Number.isFinite(n) || n < 1 || n > list.length){ alert("番号が正しくありません。"); return }
    calendar.saveSettings({ calendarId: list[n - 1].id });
    calendar.clearCache();
    render();
    await refreshCalendar({ textContent: "", disabled: false });
  }catch(e){ alert(String(e.message || e)) }
}

async function connectLink(btn){
  try{
    calendar.importSetupLink(el("#se-setup-link").value);
    el("#se-setup-link").value = "";
    await refreshCalendar(btn);
    render();
  }catch(e){ alert(e.message) }
}
