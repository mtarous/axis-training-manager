/* 利用者へそのまま送れるLINE文面。
   専門知識は一般論ではなく、その日の記録・前回比較・本人メモに結び付けて返す。 */

import { assess, lineAdvice, safetyLevel } from "./coaching.js?v=26";
import { musclesOfSession } from "../core/muscles.js?v=21";
import * as sched from "../core/schedule.js?v=28";
import * as store from "../core/store.js?v=21";
import { clientSummary } from "../core/stats.js?v=21";
import { summarizeSets, today } from "../core/model.js?v=21";
import { professionalFeedback } from "./professional-feedback.js?v=29";

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
        out.push(`${t.name}は前回${t.prev.r}回 → 今回${t.now.r}回まで伸びています。同じ動作で反復回数が増えています。動作の質も同程度だったことを確認できている場合に限り、今回の条件への適応が進んでいると考えられます。`);
      }else if(t.now.w > t.prev.w){
        const repDiff = t.now.r - t.prev.r;
        if(repDiff >= 0){
          out.push(`${t.name}は前回${t.prev.w}kg×${t.prev.r}回 → 今回${t.now.w}kg×${t.now.r}回です。前回より高い重量を同じ回数扱えています。フォーム・可動域・本人のきつさも同程度だったことを確認できている場合に限り、筋力発揮が向上している可能性があります。`);
        }else if(repDiff >= -2){
          out.push(`${t.name}は前回${t.prev.w}kg×${t.prev.r}回 → 今回${t.now.w}kg×${t.now.r}回です。重量を上げた一方で回数は少し低下しています。良し悪しはこの数値だけで決めず、フォーム・可動域・本人のきつさを含めて評価します。`);
        }else{
          out.push(`${t.name}は${t.prev.w}kg → ${t.now.w}kgへ重量を上げていますが、回数は${t.prev.r}回 → ${t.now.r}回まで低下しています。今回の負荷で反復回数とフォームが安定して再現できるかを確認します。`);
        }
      }else{
        out.push(`${t.name}は${t.now.w}kgのまま前回${t.prev.r}回 → 今回${t.now.r}回まで伸びています。同じ重量で反復回数が増えています。フォームや可動域も同程度だったことを確認できている場合に限り、今回の条件への適応が進んでいると考えられます。`);
      }
    }else if(t.state === "stall"){
      out.push(`${t.name}は記録上、同じ重量・回数が${t.same}回続いています。これだけで停滞とは断定せず、可動域・フォーム・本人のきつさ・休憩時間などの条件も合わせて確認します。`);
    }else if(t.state === "down" && t.now && t.prev){
      if(t.body){
        out.push(`${t.name}は前回${t.prev.r}回 → 今回${t.now.r}回です。1回の記録だけで筋力低下とは判断せず、体調・疲労・フォームなどの条件も含めて次回の反応を見ます。`);
      }else{
        out.push(`${t.name}は前回${t.prev.w}kg×${t.prev.r}回 → 今回${t.now.w}kg×${t.now.r}回です。1回の変化だけでは原因を決めず、体調・フォーム・可動域・本人のきつさを含めて次回も確認します。`);
      }
    }
  }
  return out;
}

function volumeLine(s){
  if(s.delta === null || !s.prev) return "";
  const signature = x => (x?.exercises || [])
    .map(e => `${String(e.name || "").trim()}#${(e.sets || []).length}`)
    .filter(Boolean)
    .sort()
    .join("|");
  const comparable = signature(s.last) === signature(s.prev);
  if(!comparable){
    return "前回と種目またはセット構成が異なるため、重量×回数の前回比は表示せず、単純比較しません。";
  }
  const label = `同じ種目・セット構成で、重量種目の外部負荷量（重量×回数の参考値）は前回比${s.delta > 0 ? "＋" : ""}${s.delta}%です。`;
  if(Math.abs(s.delta) < 5) return label + "前回に近い範囲ですが、フォーム・可動域・本人のきつさも合わせて評価します。";
  if(s.delta > 0) return label + "数値上は増えていますが、これだけで能力向上とは断定せず、フォーム・可動域・本人のきつさが同程度かも確認します。";
  return label + "数値上は低下していますが、1回の記録だけで能力低下とは判断せず、体調や動作条件も合わせて確認します。";
}

function intervalLine(a){
  if(a?.gap === null || a?.gap === undefined) return "";
  if(a.gap >= 14) return `前回から${a.gap}日空いているため、数値だけを追わず動作感覚を戻しながら進める回として評価します。`;
  if(a.gap <= 2) return `前回から${a.gap}日と間隔が短いため、回復状況・本人のきつさ・痛みの有無を確認して次回の内容を調整します。`;
  return "";
}

function evidenceLine(last){
  const observations = [last?.notes?.insight, last?.notes?.caution].filter(Boolean).join(" ").trim();
  if(observations) return "";
  return "フォーム・可動域については今回の記録だけでは判断できないため、数値とは分けて次回確認します。";
}

function goalLine(client){
  const raw = oneLine(client?.goal);
  if(!raw) return "";
  const label = raw.length > 36 ? raw.slice(0, 36) + "…" : raw;
  const lead = `目標「${label}」に対して、`;
  if(/筋力|BIG3|重量|強く/.test(raw)) return lead + "今回の重量・回数は経過として記録し、同じ条件で再現できるかを見ながら評価します。1回の数値だけで次回重量は決めません。";
  if(/筋肥大|筋量|大きく|ボディメイク/.test(raw)) return lead + "1回の重量だけでなく、セット数・本人のきつさ・フォームをそろえて継続できているかを重視します。";
  if(/減量|ダイエット|引き締め|体脂肪|体重/.test(raw)) return lead + "筋トレの数値だけで体重や体脂肪の変化は判断せず、筋力を保てているかを経過として見ます。食事と日常活動も合わせて考えます。";
  if(/痛み|腰|肩|膝|首|頸|リハビリ|改善|動作|機能/.test(raw)) return lead + "重量を伸ばすことより、痛みの有無・運動中から翌日の反応・動作の安定を優先して経過を見ます。";
  if(/競技|サッカー|野球|バレー|ゴルフ|パフォーマンス/.test(raw)) return lead + "トレーニング記録だけで競技力を断定せず、安定して力を出せるかと競技動作へのつながりを見ながら評価します。";
  return lead + "今回の記録を単発で判断せず、同じ条件での経過と本人の感覚を合わせて見ていきます。";
}

function shareLine(last){
  return oneLine(last?.notes?.share);
}

function hasProfileCaution(client){
  const text = oneLine(client?.attention);
  return /痛|しびれ|痺れ|手術|術後|めまい|血圧|脱力|腰|膝|肩|首|頸|心臓|持病|既往/.test(text);
}

function responseLine(a, last){
  if(!a || !last) return "";
  const bits = [];
  if(String(last.rpe ?? "").trim() !== "") bits.push(`きつさ ${a.rpe}/10（RPE）`);
  if(String(last.pain ?? "").trim() !== "") bits.push(`痛み ${a.pain}/10`);
  if(!bits.length) return "";
  if(a.rpe >= 9) return `今回の記録は${bits.join("、")}でした。主観的なきつさが高いため、次回は回復状態とフォームの再現性を確認して内容を調整します。`;
  if(a.pain >= 4) return `今回の記録は${bits.join("、")}でした。痛みの経過を確認し、運動で増悪しない範囲を優先します。`;
  return `今回の記録は${bits.join("、")}でした。次回の判断材料として経過を比較します。`;
}

function nextBlock(client, last, level, a){
  if(level === "stop"){
    return "次回は症状の確認を最優先にし、運動の可否から判断します。症状が続く・強くなる場合は医療機関への相談を優先してください。";
  }
  if(level === "careful"){
    return "次回は痛みや違和感、フォーム、可動域を確認しながら、その日の状態に合わせて内容を調整します。";
  }
  if(last.notes?.next) return clean(last.notes.next);
  if(last.notes?.caution) return "次回は今回の注意点を最初に確認し、症状・フォーム・可動域の変化を見てから内容を調整します。";
  if(hasProfileCaution(client)) return "次回は当日の体調・痛み・動作を確認してから内容を調整し、数値だけを理由に負荷を進めません。";
  if(a?.rpe >= 9) return "次回は負荷を上げることより、疲労の残り方とフォームの再現性を優先して調整します。";
  const goal = oneLine(client?.goal);
  if(/痛み|腰|肩|膝|首|頸|リハビリ|改善|動作|機能/.test(goal)) return "次回も痛みの有無と運動後から翌日の反応を確認し、動作が安定する範囲で内容を調整します。";
  if(/筋肥大|筋量|大きく|ボディメイク/.test(goal)) return "次回は重量だけを追わず、フォーム・可動域・本人のきつさを確認しながら、回数やセット数も含めて調整します。";
  if(/減量|ダイエット|引き締め|体脂肪|体重/.test(goal)) return "次回は無理に重量を上げず、継続できる強度と総運動量を優先して内容を調整します。";
  if(/競技|サッカー|野球|バレー|ゴルフ|パフォーマンス/.test(goal)) return "次回は数値だけでなく、反動に頼らず安定して力を出せるかを確認しながら内容を調整します。";
  if(a?.trends?.some(t => t.state === "down")) return "次回は数値を戻すことを急がず、体調と動作の安定を見ながら調整します。";
  if(a?.trends?.some(t => t.state === "stall")) return "次回は重量を追うより、可動域・テンポ・フォーム・狙った部位への入り方を確認します。";
  if(a?.trends?.some(t => t.state === "up")) return "次回は今回の良い動きを再現できるかを確認し、フォーム・可動域・余力を見ながら当日の負荷を調整します。";
  return "次回は今回の反応を基準に、フォーム・可動域・きつさ・痛みの有無を確認しながら当日の内容を調整します。";
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
    last.notes?.insight ? clean(last.notes.insight) : "",
    evidenceLine(last)
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
  const goal = level === "stop" ? "" : goalLine(client);
  const share = shareLine(last);
  const next = nextBlock(client, last, level, a);

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
${goal ? "\n\n【目標とのつながり】\n" + goal : ""}

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
${self}${share ? "\n\n【今日の共有】\n" + share : ""}

【次回の方針】
${next}

${dateLine}
また次回もよろしくお願いします😊`;
}
