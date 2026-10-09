/* LINE向けの専門フィードバック。
   記録された種目・負荷・RPE・痛み・目標から、解剖/運動学・生体力学・運動生理・栄養・ケア・セルフ運動を組み立てる。
   診断はせず、安全上の懸念がある場合は負荷提案より受診・症状確認を優先する。 */
import * as store from "../core/store.js?v=21";
import { clientSummary } from "../core/stats.js?v=21";
import { musclesOfSession } from "../core/muscles.js?v=21";
import { assess, safetyLevel } from "./coaching.js?v=26";

const has=(s,re)=>re.test((s?.exercises||[]).map(e=>e.name).join(" "));
const avgReps=s=>{const a=(s?.exercises||[]).flatMap(e=>e.sets||[]).map(x=>Number(x.reps)||0).filter(Boolean);return a.length?a.reduce((x,y)=>x+y,0)/a.length:0};
function mainName(s){
  let best="",score=-1;
  (s?.exercises||[]).forEach(e=>{
    const weighted=(e.sets||[]).reduce((a,x)=>a+(Number(x.weight)||0)*(Number(x.reps)||0),0);
    const reps=(e.sets||[]).reduce((a,x)=>a+(Number(x.reps)||0),0);
    const v=weighted>0?weighted:reps;
    if(v>score){score=v;best=String(e.name||"")}
  });
  return best;
}

function anatomy(s){
  const parts=[];
  const push=has(s,/ベンチ|チェスト|プッシュアップ|フライ/i);
  const pull=has(s,/ラット|プルダウン|懸垂|チンニング|ロー|ロウ|ワンハンド/i);
  const squat=has(s,/スクワット|レッグプレス|ブルガリアン|ランジ|ステップアップ|片脚/i);
  const hinge=has(s,/デッド|RDL|ルーマニアン|ヒップヒンジ|ヒップスラスト/i);
  const shoulder=has(s,/ショルダー|サイドレイズ|リアレイズ|フロントレイズ/i);
  if(push) parts.push("押す動作では大胸筋・三角筋前部・上腕三頭筋などが関わります。種目角度やフォームによって各筋の関与は変わります。");
  if(pull) parts.push("引く動作では広背筋、肩甲骨周囲筋、上腕二頭筋などが関わります。種目によって肩甲骨と肩関節の動き方は異なります。");
  if(squat) parts.push("下半身では大臀筋・大腿四頭筋・ハムストリングスなどが関わり、股関節と膝関節を協調して使います。");
  else if(hinge) parts.push("ヒンジ系の動作では大臀筋・ハムストリングス・脊柱周囲筋などが関わり、股関節を中心に力を伝えます。");
  if(shoulder&&!push) parts.push("肩の挙上動作では三角筋、回旋筋腱板、肩甲骨周囲筋などが協調して働きます。");
  if(parts.length>=2){
    const upper=push||pull||shoulder;
    const lower=squat||hinge;
    const lead=upper&&lower ? "上半身と下半身を組み合わせた構成です。" : upper ? "上半身の複数部位を組み合わせた構成です。" : "複数の筋群を組み合わせた構成です。";
    return lead+parts.slice(0,3).join("");
  }
  if(parts.length) return parts[0];
  const m=musclesOfSession(s);return m.length?`${m.slice(0,4).join("・")}などが関わる内容です。実際の負荷のかかり方はフォームや可動域によって変わります。`:"複数の筋群と関節を使う内容です。実際の負荷のかかり方は種目とフォームによって変わります。";
}

function biomechanics(s){
  const n=mainName(s); const pre=n?`主負荷種目の${n}では、`:"";
  if(/ブルガリアン|ランジ|片脚|ステップアップ/i.test(n)) return pre+"足部の接地、膝・股関節、骨盤の動きが大きく崩れない範囲で反復できるかを見ます。身体の形や可動域には個人差があるため、膝や骨盤の位置を一律の形に固定しません。";
  if(/スクワット|レッグプレス/i.test(n)) return pre+"足部の接地を保ちながら、膝と股関節が協調して動けているかを見ます。深さや膝の軌道は一律に決めず、痛み・可動域・体格に合う範囲を優先します。";
  if(/デッド|RDL|ルーマニアン|ヒップヒンジ/i.test(n)) return pre+"重りを身体から大きく離さず、股関節を中心に動けているかを見ます。脊柱の姿勢は完全に固定するのではなく、本人が安定して力を出せる範囲を優先します。";
  if(/ラット|プルダウン|ロー|ロウ|懸垂|ワンハンド/i.test(n)) return pre+"肘の軌道と肩甲骨の動きが自然に連動し、肩を過度にすくめたり反動に頼ったりしていないかを見ます。肩甲骨を一つの位置に固定することは目的にしません。";
  if(/ベンチ|チェスト|プッシュアップ/i.test(n)) return pre+"手首・肘・肩の位置関係と、押している間の肩甲帯の安定を見ます。肘の角度は一律に決めず、痛みなく力を伝えられる軌道を優先します。";
  return pre+"動作速度・可動域・フォームがセット後半でも大きく崩れないかを確認し、本人が安定して反復できる範囲を優先します。";
}

function physiology(s,a){
  const reps=avgReps(s);const rpe=Number(a?.rpe)||0;
  if(rpe>=9) return "入力された運動のきつさは高めです。高い努力度は有効な刺激になり得ますが、毎セット限界まで追い込む必要があるわけではありません。次回は回復状態とフォームの再現性も合わせて負荷を判断します。";
  if(reps>=15) return "高回数帯の構成です。局所疲労や筋持久力の要素が大きくなりやすい一方、筋肥大は高回数でも十分な努力度があれば狙えます。最大筋力を主目標にする場合は、より高い負荷を扱う練習との組み合わせを検討します。";
  if(reps>0&&reps<=6) return "低回数帯の構成です。筋力向上には高い負荷を扱う練習が有効ですが、回数だけでは実際の強度は判断できないため、重量・本人のきつさ・フォームを合わせて評価します。";
  return "中程度の反復回数で実施しています。この回数帯は扱いやすい範囲ですが、筋肥大や筋力の効果は回数だけで決まらないため、重量・セット数・本人のきつさ・フォームを合わせて評価します。";
}

function nutrition(client){
  const goal=String(client?.goal||"");
  if(/減量|ダイエット|引き締め|体脂肪/.test(goal)) return "回復を落とさないため極端な食事制限は避け、各食でたんぱく質源を確保してください。トレーニング前後は炭水化物を完全に抜かず、水分もこまめに補給すると運動の質を保ちやすくなります。";
  if(/筋肥大|筋力|大きく|BIG3|重量/.test(goal)) return "筋力・筋量を伸ばす時期は、1日のたんぱく質を複数回の食事に分け、トレーニング前後は炭水化物も確保すると回復と次回の出力につながります。";
  return "運動後は、たんぱく質を含む食事と水分を確保してください。特定の短い時間帯だけにこだわらず、その後数時間の食事全体を整えることを優先します。";
}

function care(s,level){
  if(level!=="ok") return "痛みや違和感がある日は強いストレッチや追い込みを避け、症状が増えない範囲の軽い関節運動と日常歩行程度に留めてください。症状が増強・持続する場合は医療機関への相談を優先してください。";
  const n=mainName(s);
  if(/スクワット|ランジ|ブルガリアン|デッド|レッグ|ヒップ/i.test(n)) return "当日〜翌日は、強い痛みがなければ軽い歩行や股関節・足関節をゆっくり動かす程度で十分です。強い筋肉痛がある部位を無理に伸ばし切る必要はありません。";
  return "痛みや違和感がなければ、肩や胸郭まわりを軽く動かし、同じ姿勢を長時間続けないようにしてください。強い張りがある日は無理に可動域を広げる必要はありません。";
}

function selfExercise(s,level){
  if(level!=="ok") return "自宅では新しい運動を増やさず、症状が増えない範囲の軽い動きに留めてください。痛み・しびれ・脱力が強くなる場合は中止してください。";
  const n=mainName(s);
  if(/ラット|プルダウン|ロー|ロウ|ショルダー|サイドレイズ|ベンチ|チェスト/i.test(n)) return "自宅で行う候補としては、痛みや違和感がなければ壁スライドをゆっくり8〜10回程度。肩をすくめず、無理に可動域を広げない範囲で行います。";
  if(/スクワット|ブルガリアン|ランジ|片脚|レッグプレス/i.test(n)) return "自宅で行う候補としては、痛みや違和感がなければ椅子からの立ち座りを8〜12回程度。足部の接地と動作の安定を確認する目的で行います。";
  if(/デッド|RDL|ヒップヒンジ|ヒップスラスト/i.test(n)) return "自宅で行う候補としては、痛みや違和感がなければ壁タッチ・ヒップヒンジを8〜10回程度。重量は使わず、股関節から動く感覚を確認します。";
  return "自宅では、痛みや違和感がなければ当日使った部位を軽く動かすか、5〜10分程度歩くくらいで十分です。";
}

export function professionalFeedback(clientId){
  const client=store.client(clientId);const s=clientSummary(clientId);if(!client||!s.last)return null;
  const a=assess(clientId);const level=safetyLevel(clientId);
  return {anatomy:anatomy(s.last),biomechanics:biomechanics(s.last),physiology:physiology(s.last,a),nutrition:nutrition(client),care:care(s.last,level),self:selfExercise(s.last,level),level};
}
