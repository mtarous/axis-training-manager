/* 利用者に送るLINE文面を組み立てる。
   旧アプリの professionalAdvice / professionalLine を v2 のデータで作り直したもの。
   文面はそのまま送る前提ではなく、直して使うたたき台。 */

import { lineAdvice, safetyLevel } from "./coaching.js?v=18";
import { musclesOfSession } from "../core/muscles.js?v=18";
import * as sched from "../core/schedule.js?v=18";
import * as store from "../core/store.js?v=18";
import { clientSummary, nextTargets } from "../core/stats.js?v=18";
import { today } from "../core/model.js?v=18";
import { professionalFeedback } from "./professional-feedback.js?v=18";

const jp = d => {
  const x = new Date(String(d).slice(0, 10) + "T00:00:00+09:00");
  return Number.isNaN(x.getTime()) ? d
    : x.toLocaleDateString("ja-JP", { month: "long", day: "numeric", weekday: "short" });
};

/* 名前の呼びかけ。「青木 理沙」→「青木さん」 */
function callName(name){
  const s = String(name || "").trim();
  if(/さん$|様$|さま$/.test(s)) return s;
  const head = s.split(/[\s　]+/)[0];
  return (head || s) + "さん";
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
  if(!s.last) return callName(client.name) + "、本日もありがとうございました。";

  const last = s.last;
  const muscles = musclesOfSession(last);
  const level = safetyLevel(clientId);
  const pro = professionalFeedback(clientId);
  const appt = nextAppointment(clientId);
  const clean = v => String(v || "").replace(/^・/gm, "").trim();
  const names = {"胸":"大胸筋","肩":"三角筋","三頭":"上腕三頭筋","二頭":"上腕二頭筋","ハム":"ハムストリングス","臀筋":"臀筋群","腹筋":"腹筋群","ふくらはぎ":"下腿三頭筋"};
  const partLine = muscles.length
    ? `本日は${muscles.slice(0,4).map(m => names[m] || m).join("・")}を中心に実施しました。`
    : `本日は${last.exercises.length}種目を実施しました。`;

  const observed = [];
  if(s.delta !== null){
    if(s.delta >= 5) observed.push(`総負荷量は前回比＋${s.delta}%で、トレーニング量を段階的に伸ばせています。`);
    else if(s.delta <= -10) observed.push(`総負荷量は前回比${s.delta}%でした。今回は数値を無理に戻すより、動作の質と体調を優先します。`);
    else observed.push(`総負荷量は前回比${s.delta > 0 ? "＋" : ""}${s.delta}%で、前回と近い負荷量を維持しています。`);
  }
  if(last.notes?.insight) observed.push(clean(last.notes.insight));

  let next = "";
  if(level === "stop") next = "次回は負荷を上げず、症状の確認を優先します。症状が持続・増強する場合は医療機関への相談を優先してください。";
  else if(level === "careful") next = "次回は重量を据え置き、痛みや違和感が出ない範囲でフォームの再現性を確認します。";
  else if(last.notes?.next) next = clean(last.notes.next);
  else {
    const list = nextTargets(clientId, 3);
    next = list.length ? list.map(t => `${t.name}：${t.text}`).join("\n") : "今回の内容を基準に、体調とフォームを確認しながら負荷を調整します。";
  }

  const safetyBlock = level !== "ok" ? `\n【安全面】\n${lineAdvice(clientId)[0]}\n` : "";
  const dateLine = appt
    ? `次回は${jp(appt.date)} ${appt.time}〜のご予約です。ご都合は大丈夫でしょうか？`
    : "次回のご予約がまだ入っていません。ご都合の良い日時を教えてください。";

  return `${callName(client.name)}、本日もありがとうございました。

【本日のトレーニング】
${partLine}${observed.length ? "\n" + observed.join("\n") : ""}${safetyBlock}

【専門フィードバック】
・解剖学・運動学：${pro?.anatomy || "実施種目に応じた筋群と関節運動を確認しています。"}
・生体力学：${pro?.biomechanics || "可動域と姿勢をそろえ、代償動作を増やさないことを優先します。"}
・運動生理学：${pro?.physiology || "疲労度と回復を見ながら、無理なく負荷を積み上げます。"}

【回復・栄養】
・栄養：${pro?.nutrition || "運動後は食事と水分を整え、回復を優先してください。"}
・ケア：${pro?.care || "無理のない範囲で身体を動かし、強い違和感がある場合は休養を優先してください。"}

【自宅でできること】
${pro?.self || "痛みのない範囲で軽く身体を動かしてください。"}

【次回の方針】
${next}

${dateLine}
また次回もよろしくお願いします。`;
}
