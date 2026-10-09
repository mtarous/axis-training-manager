/* 利用者に送るLINE文面を組み立てる。
   旧アプリの professionalAdvice / professionalLine を v2 のデータで作り直したもの。
   文面はそのまま送る前提ではなく、直して使うたたき台。 */

import { lineAdvice, safetyLevel } from "./coaching.js?v=21";
import * as sched from "../core/schedule.js?v=21";
import * as store from "../core/store.js?v=21";
import { clientSummary, nextTargets } from "../core/stats.js?v=21";
import { today } from "../core/model.js?v=21";
import { professionalFeedback } from "./professional-feedback.js?v=22";

const jp = d => {
  const x = new Date(String(d).slice(0, 10) + "T00:00:00+09:00");
  return Number.isNaN(x.getTime()) ? d
    : x.toLocaleDateString("ja-JP", { month: "long", day: "numeric", weekday: "short" });
};

/* 名前の呼びかけ。「青木 理沙」→「青木さん」 */
function callName(client){
  const name = String(client?.name || client || "").trim();
  if(/さん$|様$|さま$/.test(name)) return name;
  const parts = name.split(/[\s　]+/).filter(Boolean);
  if(client?.partnerId && parts.length >= 2){
    const mate = store.client(client.partnerId);
    const mp = String(mate?.name || "").trim().split(/[\s　]+/).filter(Boolean);
    if(mp.length >= 2 && mp[0] === parts[0]) return parts.slice(1).join(" ") + "さん";
  }
  return (parts[0] || name) + "さん";
}

/* 次の予定。無ければ null */
export function nextAppointment(clientId){
  const t = today();
  return sched.all().find(x => (x.clientId === clientId || x.clientIds?.includes(clientId)) && x.date >= t) || null;
}

/* 今日のポイントは coaching.js が記録から組み立てる。
   ここでは文面に載せる形に整えるだけ。 */
export function coachingAdvice(client){
  return lineAdvice(client.id);
}

export function lineMessage(clientId){
  const client = store.client(clientId);
  if(!client) return "";
  const s = clientSummary(clientId);
  if(!s.last) return callName(client) + "、本日もありがとうございました。";

  const last = s.last;
  const level = safetyLevel(clientId);
  const pro = professionalFeedback(clientId);
  const appt = nextAppointment(clientId);
  const clean = v => String(v || "").replace(/^・/gm, "").trim();

  const exerciseNames = [...new Set((last.exercises || []).map(e => String(e.name || "").trim()).filter(Boolean))];
  const partLine = exerciseNames.length
    ? `本日は${exerciseNames.slice(0,3).join("・")}${exerciseNames.length > 3 ? "など" : ""}を実施しました。`
    : `本日は${last.exercises.length}種目を実施しました。`;

  const observed = [];
  if(s.delta !== null){
    if(s.delta >= 5) observed.push(`総負荷量は前回比＋${s.delta}%でした。フォームを保てている範囲で、トレーニング量を伸ばせています。`);
    else if(s.delta <= -10) observed.push(`総負荷量は前回比${s.delta}%でした。今回は数値を無理に戻さず、フォームと体調を優先しています。`);
    else observed.push(`総負荷量は前回比${s.delta > 0 ? "＋" : ""}${s.delta}%で、前回に近い負荷を安定して行えています。`);
  }
  if(last.notes?.insight) observed.push(clean(last.notes.insight));

  let next = "";
  if(level === "stop") next = "次回は負荷を上げず、症状の確認を優先します。症状が続く、または強くなる場合は医療機関への相談を優先してください。";
  else if(level === "careful") next = "次回は重量を据え置き、痛みや違和感が出ない範囲でフォームを確認します。";
  else if(last.notes?.next) next = clean(last.notes.next);
  else {
    const list = nextTargets(clientId, 3);
    next = list.length
      ? list.map(t => `${t.name}：${String(t.text).replace(/を試す$/, "を目安に進めます")}`).join("\n")
      : "今回の内容を基準に、体調とフォームを見ながら負荷を調整します。";
  }

  const safetyBlock = level !== "ok" ? `

【体調面】
${lineAdvice(clientId)[0]}` : "";
  const dateLine = appt
    ? `次回は${jp(appt.date)} ${appt.time}〜のご予約です。ご都合は大丈夫でしょうか？`
    : "次回のご予約がまだ入っていません。ご都合の良い日時を教えてください。";

  return `${callName(client)}、本日もありがとうございました😊

【今日のトレーニング】
${partLine}${observed.length ? "\n" + observed.join("\n") : ""}${safetyBlock}

【解剖学・運動学】
${pro?.anatomy || "今日行った種目で使う筋肉と関節の動きを確認しながら進めました。"}

【生体力学】
${pro?.biomechanics || "フォームをそろえて、特定の部位に負担が集中しない動きを意識しました。"}

【運動生理学】
${pro?.physiology || "今日の負荷と回数に合わせて、疲労を残しすぎない範囲で刺激を入れています。"}

【回復・栄養】
栄養：${pro?.nutrition || "運動後は水分と食事を整えて、回復を優先しましょう。"}
ケア：${pro?.care || "当日〜翌日は無理に追い込まず、軽く動かす程度で十分です。"}

【自宅でできること】
${pro?.self || "痛みのない範囲で軽く身体を動かしてください。"}

【次回】
${next}

${dateLine}
また次回もよろしくお願いします😊`;
}
