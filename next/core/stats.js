/* 画面に出す数字をまとめる。表示の都合はここで吸収し、画面側では計算しない。 */

import { sessionSetCount, sessionVolume } from "./model.js?v=21";
import * as store from "./store.js?v=21";

export function clientSummary(clientId){
  const list = store.sessions({ clientId });
  const last = list[0] || null;
  const prev = list[1] || null;
  const vol  = last ? Math.round(sessionVolume(last)) : 0;
  const prevVol = prev ? Math.round(sessionVolume(prev)) : 0;
  return {
    count: list.length,
    last, prev,
    lastDate: last?.date || "",
    volume: vol,
    delta: prevVol ? Math.round((vol - prevVol) / prevVol * 100) : null,
    sets: last ? sessionSetCount(last) : 0
  };
}

/* 直近のセッションの総負荷。棒グラフ用に古い順で返す。 */
export function volumeTrend(clientId, limit = 8){
  return store.sessions({ clientId })
    .slice(0, limit)
    .map(s => ({ date: s.date, value: Math.round(sessionVolume(s)) }))
    .reverse();
}

export function deltaText(delta){
  if(delta === null || !Number.isFinite(delta)) return "—";
  if(delta === 0) return "±0%";
  return (delta > 0 ? "+" : "") + delta + "%";
}

/* 次回の目安。同じ重量で全セット出来ていれば1段上げる。
   その回の内容だけを見るので、過去の記録にも同じ計算が使える。 */
export function targetsForSession(session, limit = 5){
  if(!session?.exercises?.length) return [];
  return session.exercises.slice(0, limit).map(e => {
    const top = e.sets.reduce((a, s) =>
      (typeof s.weight === "number" && s.weight > a.weight ? s : a), e.sets[0]);
    if(typeof top.weight !== "number" || !top.weight){
      return { name: e.name, text: "回数を1〜2回のばす" };
    }
    const same = e.sets.filter(s => s.weight === top.weight);
    const steady = same.length >= 2 && same.every(s => s.reps >= top.reps);
    const step = top.weight >= 60 ? 5 : top.weight >= 20 ? 2.5 : 1;
    return steady
      ? { name: e.name, text: (top.weight + step) + "kg × " + top.reps + "回を試す" }
      : { name: e.name, text: top.weight + "kg で回数をそろえる" };
  });
}

export function nextTargets(clientId, limit = 5){
  return targetsForSession(store.sessions({ clientId })[0], limit);
}
