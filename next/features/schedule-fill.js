/* 予定にあるのに記録がない過去の回を、直前（なければ直後）の記録と同じ内容で記録にする。
   source:"schedule" の印を付け、実際の記録と見分けられるようにする。ゴミ箱へ送れば元に戻る。 */

import * as store from "../core/store.js?v=21";
import { makeExercise, makeSession, today } from "../core/model.js?v=21";
import { estimatedSessions } from "./next-menu.js?v=2";

/* 入る予定の一覧（古い順）。記録が1件もないお客様は、元にする内容がないので入れない。 */
export function pendingFills(until = today()){
  return store.clients()
    .flatMap(c => {
      const all = store.sessions({ clientId: c.id });
      if(!all.some(s => s.source !== "schedule")) return [];
      return estimatedSessions(c.id, all, until)
        .map(e => ({ clientId: c.id, name: c.name, date: e.date, exercises: e.exercises }));
    })
    .sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name));
}

export function applyFills(list){
  return store.saveSessions(list.map(f => makeSession(f.clientId, f.date, {
    exercises: f.exercises.map(e => makeExercise(e.name, e.sets)),
    source: "schedule"
  }))).length;
}

export function filledSessions(){
  return store.sessions().filter(s => s.source === "schedule");
}

/* 補完分だけをゴミ箱へ。30日以内なら戻せる。 */
export function undoFills(){
  const list = filledSessions();
  list.forEach(s => store.deleteSession(s.id));
  return list.length;
}

/* 確認用の短い説明：お客様ごとの件数 */
export function summarize(list){
  const by = {};
  list.forEach(f => { by[f.name] = (by[f.name] || 0) + 1 });
  return Object.entries(by).sort((a, b) => b[1] - a[1]).map(([n, k]) => n + "　" + k + "件");
}
