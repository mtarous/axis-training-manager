/* 利用者に送るLINE文面を組み立てる。
   旧アプリの professionalAdvice / professionalLine を v2 のデータで作り直したもの。
   文面はそのまま送る前提ではなく、直して使うたたき台。 */

import { lineAdvice, safetyLevel } from "./coaching.js?v=14";
import { musclesOfSession } from "../core/muscles.js?v=14";
import * as sched from "../core/schedule.js?v=14";
import * as store from "../core/store.js?v=14";
import { clientSummary, nextTargets } from "../core/stats.js?v=14";
import { today } from "../core/model.js?v=14";

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
  return sched.all().find(x => x.clientId === clientId && x.date >= t) || null;
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
  if(!s.last) return callName(client.name) + "、本日もありがとうございました😊";

  const muscles = musclesOfSession(s.last);
  /* 進めていい状態のときだけ、次回の目安に重量を出す。
     痛みや症状が出ているときに増量を勧めると、助言と矛盾してしまう。 */
  const level = safetyLevel(clientId);
  const list = level === "ok" ? nextTargets(clientId, 3) : [];
  const targets =
    level === "stop"
      ? "次回は負荷を上げずに、痛みや症状の出ない範囲で動きの確認をしていきます。"
      : level === "careful"
        ? "次回は同じ重量のまま、無理のない範囲で回数をそろえていきます。"
        : list.length
          ? "次回の目安です。\n" + list.map(t => "・" + t.name + "：" + t.text).join("\n")
          : "次回は今回の内容をもとに、状態を見ながら調整していきます。";

  let progress = "今回の内容を安定して行えています";
  if(s.delta !== null && s.delta >= 5) progress = `総負荷量が前回より約${s.delta}%伸びています`;
  else if(muscles.length) progress = `${muscles.slice(0, 3).join("・")}を中心にしっかり追い込めました`;

  const appt = nextAppointment(clientId);
  const dateLine = appt
    ? `次回は${jp(appt.date)} ${appt.time}〜のご予約です。ご都合は大丈夫でしょうか？`
    : "次回のご予約がまだ入っていません。ご都合の良い日時を教えてください。";

  const share = s.last.notes?.share ? "\n" + s.last.notes.share + "\n" : "";

  return `${callName(client.name)}、本日もありがとうございました😊
${level === "stop" ? "今回もおつかれさまでした。" : `今回は${progress}。`}
${share}
${targets}

【今日のポイント】
${lineAdvice(clientId).join("\n\n")}

${dateLine}
また次回もよろしくお願いします😊`;
}
