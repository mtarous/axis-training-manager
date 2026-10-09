/* 利用者へそのまま送れるLINE文面。
   専門知識は一般論ではなく、その日の記録・前回比較・本人メモに結び付けて返す。 */

import { assess, lineAdvice, safetyLevel } from "./coaching.js?v=21";
import { musclesOfSession } from "../core/muscles.js?v=21";
import * as sched from "../core/schedule.js?v=21";
import * as store from "../core/store.js?v=21";
import { clientSummary, nextTargets } from "../core/stats.js?v=21";
import { summarizeSets, today } from "../core/model.js?v=21";
import { professionalFeedback } from "./professional-feedback.js?v=22";

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
const oneLine = v => clean(v).replace(/\s+/g, " ");
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

function exerciseRecordLines(session, limit = 5){
  return (session?.exercises || []).slice(0, limit).map(e =>
    "・" + e.name + "：" + setText(e.sets)
  );
}

function trendLines(a, limit = 3){
  if(!a?.trends?.length) return [];
  const out = [];
  for(const t of a.trends){
    if(out.length >= limit) break;
    if(t.state === "up" && t.now && t.prev){
      if(t.body){
        out.push(`${t.name}は前回${t.prev.r}回 → 今回${t.now.r}回まで伸びています。同じ動作で反復回数が増えており、動作への適応が進んでいます。`);
      }else if(t.now.w > t.prev.w){
        const repDiff = t.now.r - t.prev.r;
        if(repDiff >= 0){
          out.push(`${t.name}は前回${t.prev.w}kg×${t.prev.r}回 → 今回${t.now.w}kg×${t.now.r}回まで伸びています。重量を上げても回数を維持できており、筋力発揮が明確に向上しています。`);
        }else if(repDiff >= -2){
          out.push(`${t.name}は前回${t.prev.w}kg×${t.prev.r}回 → 今回${t.now.w}kg×${t.now.r}回です。重量を上げた分だけ回数は少し落ちていますが、負荷設定としては自然な範囲なので、次回は同重量で回数をそろえるのが目安です。`);
        }else{
          out.push(`${t.name}は${t.prev.w}kg → ${t.now.w}kgへ重量を上げていますが、回数は${t.prev.r}回 → ${t.now.r}回まで低下しています。次回は重量をさらに上げず、今回の重量で反復回数とフォームを安定させます。`);
        }
      }else{
        out.push(`${t.name}は${t.now.w}kgのまま前回${t.prev.r}回 → 今回${t.now.r}回まで伸びています。同じ重量で反復回数が増えているため、次の重量アップにつなげやすい状態です。`);
      }
    }else if(t.state === "stall"){
      out.push(`${t.name}は同じ負荷が${t.same}回続いています。すぐ重量を上げるより、可動域・テンポ・フォームをそろえてから次の段階へ進む方が伸びやすい状態です。`);
    }else if(t.state === "down" && t.now && t.prev){
      if(t.body){
        out.push(`${t.name}は前回${t.prev.r}回 → 今回${t.now.r}回です。1回の低下だけで筋力低下とは判断せず、睡眠・疲労・体調も含めて次回の反応を見ます。`);
      }else{
        out.push(`${t.name}は前回${t.prev.w}kg×${t.prev.r}回 → 今回${t.now.w}kg×${t.now.r}回です。今回は数値を無理に戻さず、動作の質と回復状態を確認してから再度伸ばします。`);
      }
    }
  }
  return out;
}

function volumeLine(s){
  if(s.delta === null) return "";
  if(s.delta >= 15) return `重量種目ベースの総負荷量（重量×回数）は前回比＋${s.delta}%です。伸びは大きい一方で増加幅も大きいため、次回はさらに上げるより、同程度の負荷でフォームと可動域をそろえられるかを確認します。`;
  if(s.delta >= 5) return `重量種目ベースの総負荷量（重量×回数）は前回比＋${s.delta}%です。前回より仕事量を増やせており、段階的に負荷を積み上げられています。`;
  if(s.delta <= -15) return `重量種目ベースの総負荷量（重量×回数）は前回比${s.delta}%です。今回は数値を戻すことより、体調と動作の質を優先した内容になっています。`;
  return `重量種目ベースの総負荷量（重量×回数）は前回比${s.delta > 0 ? "＋" : ""}${s.delta}%で、前回に近いトレーニング量を維持できています。`;
}

function intervalLine(a){
  if(a?.gap === null || a?.gap === undefined) return "";
  if(a.gap >= 14) return `前回から${a.gap}日空いているため、数値だけを追わず動作感覚を戻しながら進める回として評価します。`;
  if(a.gap <= 2) return `前回から${a.gap}日と間隔が短いため、筋疲労が残っていないかを見ながら次回の負荷を決めます。`;
  return "";
}

function responseLine(a, last){
  if(!a || !last) return "";
  const bits = [];
  if(String(last.rpe ?? "").trim() !== "") bits.push(`RPE ${a.rpe}/10`);
  if(String(last.pain ?? "").trim() !== "") bits.push(`痛み ${a.pain}/10`);
  if(!bits.length) return "";
  if(a.rpe >= 9) return `今回の身体反応は${bits.join("、")}です。運動強度がかなり高いため、次回はさらに負荷を上げるより回復とフォームの再現性を優先します。`;
  if(a.pain >= 4) return `今回の身体反応は${bits.join("、")}です。痛みが出ているため、負荷量より症状が増えない範囲と動作の安定を優先します。`;
  return `今回の身体反応は${bits.join("、")}です。この反応も次回の重量・回数設定に反映します。`;
}

function nextBlock(clientId, last, level){
  if(level === "stop"){
    return "次回は負荷を上げず、症状の確認を優先します。症状が続く・強くなる場合は医療機関への相談を優先してください。";
  }
  if(level === "careful"){
    return "次回は重量を据え置き、痛みや違和感が出ない可動域でフォームの再現性を確認します。";
  }
  if(last.notes?.next) return clean(last.notes.next);
  const list = nextTargets(clientId, 4);
  if(!list.length) return "今回の内容を基準に、フォームと体調を見ながら負荷を調整します。";
  return list.map(t => "・" + t.name + "：" + String(t.text).replace(/を試す$/, "を目安に進めます")).join("\n");
}

export function lineMessage(clientId){
  const client = store.client(clientId);
  if(!client) return "";
  const s = clientSummary(clientId);
  if(!s.last) return callName(client) + "、本日もありがとうございました😊";

  const last = s.last;
  const a = assess(clientId);
  const pro = professionalFeedback(clientId);
  const level = safetyLevel(clientId);
  const appt = nextAppointment(clientId);
  const muscles = musclesOfSession(last);
  const muscleText = muscles.length ? muscles.slice(0, 5).join("・") : "全身";

  const record = exerciseRecordLines(last).join("\n");
  const changes = (level === "ok" ? [
    ...trendLines(a),
    volumeLine(s),
    intervalLine(a),
    last.notes?.insight ? clean(last.notes.insight) : ""
  ] : [
    intervalLine(a),
    last.notes?.insight ? clean(last.notes.insight) : ""
  ]).filter(Boolean);

  const anatomy = oneLine(pro?.anatomy) || `${muscleText}を中心に、実施種目に必要な筋肉と関節運動を確認しています。`;
  const biomechanics = oneLine(pro?.biomechanics) || "重心位置・関節の向き・可動域をそろえ、狙った部位へ負荷を伝えることを優先しています。";
  const physiology = [oneLine(pro?.physiology), responseLine(a, last)].filter(Boolean).join(" ") || "今回の負荷と回数に対する疲労反応を見ながら、次回の強度を調整します。";
  const nutrition = oneLine(pro?.nutrition) || "運動後はたんぱく質を含む食事と水分を確保し、次回までの回復につなげてください。";
  const care = oneLine(pro?.care) || "強い張りが残る場合は追い込まず、軽い歩行や関節運動で身体を動かす程度で十分です。";
  const self = oneLine(pro?.self) || "痛みのない範囲で、今回使った部位を軽く動かしてください。";
  const next = nextBlock(clientId, last, level);

  const safety = level !== "ok"
    ? "\n\n【体調面】\n" + (lineAdvice(clientId)[0] || "痛みや違和感を確認しながら進めます。")
    : "";

  const dateLine = appt
    ? `次回は${jp(appt.date)} ${appt.time}〜のご予約です。ご都合は大丈夫でしょうか？`
    : "次回のご予約がまだ入っていません。ご都合の良い日時を教えてください。";

  return `${callName(client)}、本日もありがとうございました😊

【今日の記録】
${record}
${changes.length ? "\n【今回の変化】\n" + changes.map(x => "・" + x).join("\n") : ""}

【解剖学・運動学】
${anatomy}

【生体力学】
${biomechanics}

【運動生理学】
${physiology}${safety}

【回復・栄養】
${nutrition}
${care}

【自宅でできること】
${self}

【次回】
${next}

${dateLine}
また次回もよろしくお願いします😊`;
}
