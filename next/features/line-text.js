/* 利用者へそのまま送れるLINE文面。
   専門知識は一般論ではなく、その日の記録・前回比較・本人メモに結び付けて返す。 */

import { professionalFeedback } from "./professional-feedback.js?v=29";
import { assess, lineAdvice, safetyLevel } from "./coaching.js?v=26";
import * as sched from "../core/schedule.js?v=28";
import * as store from "../core/store.js?v=21";
import { clientSummary } from "../core/stats.js?v=21";
import { summarizeSets, today } from "../core/model.js?v=21";

const jp = d => {
  const x = new Date(String(d).slice(0, 10) + "T00:00:00+09:00");
  return Number.isNaN(x.getTime()) ? d
    : x.toLocaleDateString("ja-JP", { month: "long", day: "numeric", weekday: "short" });
};

function callName(client){
  const s = String(client?.name || "").trim();
  if(/さん$|様$|さま$/.test(s)) return s;
  const parts = s.split(/[\s　]+/).filter(Boolean);
  if(client?.pairLabel && parts.length >= 2) return parts[parts.length - 1] + "さん";
  return (parts[0] || s) + "さん";
}

const clean = v => String(v || "").replace(/^・/gm, "").trim();
const setText = sets => summarizeSets(sets)
  .replace(/\s×\s/g, "×")
  .replace(/set/g, "セット")
  .replace(/\s\/\s/g, " ／ ");

export function nextAppointment(clientId){
  const t = today();
  return sched.all().find(x => (x.clientId === clientId || x.clientIds?.includes(clientId)) && x.date >= t) || null;
}

export function coachingAdvice(client){
  return lineAdvice(client.id);
}

function exerciseRecordLines(session, limit = Infinity){
  return (session?.exercises || []).slice(0, limit).map(e =>
    "・" + e.name + "：" + setText(e.sets)
  );
}

export function lineMessage(clientId){
  const client = store.client(clientId);
  if(!client) return "";
  const s = clientSummary(clientId);
  if(!s.last) return callName(client) + "、本日もありがとうございました😊";

  const last = s.last;
  const a = assess(clientId);
  const level = safetyLevel(clientId);
  const appt = nextAppointment(clientId);
  const notes = last.notes || {};

  // 本人への観察・共有を優先。数値比較は変化のある1種目だけに絞る。
  const points = [];
  if(notes.insight) points.push(clean(notes.insight));
  if(level === "ok"){
    const t = a?.trends?.find(t => t.now && t.prev &&
      (t.now.w !== t.prev.w || t.now.r !== t.prev.r));
    if(t){
      const value = x => t.body ? `${x.r}回` : `${x.w}kg×${x.r}回`;
      points.push(`${t.name}は前回${value(t.prev)} → 今回${value(t.now)}でした。`);
    }
  }
  if(notes.caution) points.push(clean(notes.caution));
  if(level !== "ok"){
    const advice = lineAdvice(clientId)[0];
    if(advice) points.push(advice);
  }
  if(notes.share) points.push(clean(notes.share));
  if(level === "ok" && !notes.insight && !notes.caution && !notes.share){
    // 専門分野の説明を並べず、その回の主要種目に合う確認点を1文だけ選ぶ。
    const cue = professionalFeedback(clientId)?.biomechanics?.split("。")[0];
    if(cue) points.push(cue
      .replace("今回の種目のうち", "次回の")
      .replace(/足部の接地/g, "足裏のつき方")
      .replace(/可動域/g, "動かす範囲")
      .replace(/協調して/g, "連動して")
      .replace(/肩甲帯/g, "肩まわり")
      .replace(/軌道/g, "動く方向")
      .replace(/反復/g, "繰り返し")
      .replace(/を見ます$|を確認し.*$/, "を確認していきましょう") + "。");
  }


  // フォームや疲労が未記録なら、良好だったと推測しない。
  // 同じ設定が続いているだけの種目に、停滞の説明を繰り返さない。
  if(!points.length){
    const t = a?.trends?.find(t => t.now && t.prev);
    if(t) points.push(`${t.name}は前回と同じ重量・回数で取り組まれました。`);
  }
  if(level === "ok" && String(last.rpe ?? "").trim() !== ""){
    points.push(`今回のきつさは10段階で${a.rpe}でした。次回も疲れの残り方を確認しながら調整します。`);
  }
  if(a?.gap >= 14) points.push(`前回から${a.gap}日ぶりでしたので、次回も身体の反応を見ながら進めましょう。`);

  const unique = [...new Set(points.filter(Boolean))];
  // 手入力の伝達事項・症状は文字数のために切り捨てない。
  const next = notes.next && level === "ok" ? clean(notes.next) : "";
  const dateLine = appt
    ? `次回は${jp(appt.date)} ${appt.time}〜です。`
    : "";
  return [
    `${callName(client)}、本日もありがとうございました😊`,
    "【今日の記録】\n" + exerciseRecordLines(last).join("\n"),
    unique.length ? "【今日のポイント】\n" + unique.join("\n") : "",
    next,
    dateLine,
    "また次回もよろしくお願いします😊"
  ].filter(Boolean).join("\n\n");
}
