/* AXIS v2 データモデル
   いちばん下の約束ごと：
   - 利用者もセッションも種目も、必ず id を持つ
   - 1回のトレーニング = 1セッション。種目はその中、セットはさらにその中
   - 消す = deletedAt を入れる。直す = updatedAt を進める
   この3つだけで、削除・編集・ゴミ箱・持ち出しが同じ仕組みで説明できる。 */

export const BODYWEIGHT = "自重";

export function nowISO(){ return new Date().toISOString() }
export function today(){ return new Date().toLocaleDateString("sv-SE") }

let seq = 0;
export function newId(prefix){
  seq += 1;
  return prefix + ":" + Date.now().toString(36) + seq.toString(36);
}

export function num(v, d = 0){
  const x = parseFloat(v);
  return Number.isFinite(x) ? x : d;
}
export function round1(x){ return Math.round(x * 10) / 10 }

/* 重量は数値か "自重" のどちらか。それ以外は数値に寄せる。 */
export function normWeight(v){
  if(v === BODYWEIGHT) return BODYWEIGHT;
  const s = String(v ?? "").trim();
  if(s.includes(BODYWEIGHT) || s === "") return s.includes(BODYWEIGHT) ? BODYWEIGHT : 0;
  return round1(num(s, 0));
}
export function weightText(w){
  return String(w) === BODYWEIGHT ? BODYWEIGHT : String(w) + "kg";
}

export function makeClient(name, extra = {}){
  return {
    id: newId("c"),
    name: String(name || "").trim(),
    goal: "",
    attention: "",
    active: true,
    createdAt: nowISO(),
    updatedAt: nowISO(),
    ...extra
  };
}

export function makeSet(weight = 0, reps = 10){
  return { weight: normWeight(weight), reps: Math.max(0, Math.round(num(reps, 10))) };
}

export function makeExercise(name = "", sets){
  return {
    id: newId("e"),
    name: String(name || "").trim(),
    sets: Array.isArray(sets) && sets.length ? sets.map(s => makeSet(s.weight, s.reps)) : [makeSet()]
  };
}

export function makeSession(clientId, date, extra = {}){
  return {
    id: newId("s"),
    clientId: clientId || "",
    date: date || today(),
    status: "完了",
    rpe: "",
    pain: "",
    notes: { insight:"", caution:"", share:"", next:"" },
    exercises: [makeExercise()],
    done: {},              // 種目id → 完了したセット番号の配列
    source: "app",
    createdAt: nowISO(),
    updatedAt: nowISO(),
    deletedAt: null,
    ...extra
  };
}

/* 保存前に形を整える。壊れた値はここで落とす。 */
export function normalizeSession(s){
  const out = {
    id: s.id || newId("s"),
    clientId: s.clientId || "",
    date: String(s.date || today()).slice(0, 10),
    status: s.status || "完了",
    rpe: s.rpe ?? "",
    pain: s.pain ?? "",
    notes: {
      insight: String(s.notes?.insight || ""),
      caution: String(s.notes?.caution || ""),
      share:   String(s.notes?.share   || ""),
      next:    String(s.notes?.next    || "")
    },
    exercises: (Array.isArray(s.exercises) ? s.exercises : [])
      .map(e => ({
        id: e.id || newId("e"),
        name: String(e.name || "").trim(),
        sets: (Array.isArray(e.sets) && e.sets.length ? e.sets : [makeSet()])
          .map(x => makeSet(x.weight, x.reps))
      }))
      .filter(e => e.name || e.sets.some(x => num(x.weight) || x.reps)),
    done: s.done && typeof s.done === "object" ? s.done : {},
    source: s.source === "legacy" ? "legacy" : "app",
    createdAt: s.createdAt || nowISO(),
    updatedAt: s.updatedAt || nowISO(),
    deletedAt: s.deletedAt || null
  };
  if(!out.exercises.length) out.exercises = [makeExercise()];
  return out;
}

/* 総負荷量。自重は 0 として数えない。 */
export function sessionVolume(s){
  return (s.exercises || []).reduce((sum, e) =>
    sum + e.sets.reduce((a, x) => a + (String(x.weight) === BODYWEIGHT ? 0 : num(x.weight) * num(x.reps)), 0), 0);
}

export function sessionSetCount(s){
  return (s.exercises || []).reduce((a, e) => a + e.sets.length, 0);
}

/* 同じ重量×回数が続くセットは「40kg×10回×3set」とまとめて読ませる */
export function summarizeSets(sets){
  const parts = [];
  (sets || []).forEach(x => {
    const last = parts[parts.length - 1];
    if(last && String(last.weight) === String(x.weight) && last.reps === x.reps) last.count += 1;
    else parts.push({ weight: x.weight, reps: x.reps, count: 1 });
  });
  return parts.map(p => weightText(p.weight) + " × " + p.reps + "回" + (p.count > 1 ? " × " + p.count + "set" : "")).join(" / ");
}
