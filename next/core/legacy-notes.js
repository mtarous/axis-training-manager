/* 過去データの種目メモを、セッション単位の4欄へ整理する。
   元文を捨てず、同じ文を複数欄へコピーしない。 */

const cautionRe = /(痛|違和感|しびれ|反動|崩れ|崩れやす|注意|要確認|確認が必要|入り[づず]ら|使いにく|効きにく|しやすい|不安定|左右差|開きやす|すくみ|代償|負担|懸念|中止)/;

const tidy = v => String(v ?? "").replace(/\s+/g, " ").trim();
function addUnique(list, text){
  const v = tidy(text);
  if(v && !list.includes(v)) list.push(v);
}
function dose(r){
  const w = String(r?.weight ?? "").trim();
  const reps = String(r?.reps ?? "").trim();
  const sets = String(r?.sets ?? "").trim();
  const a = [];
  if(w) a.push(w === "自重" ? "自重" : `${w}kg`);
  if(reps) a.push(/^\d+(?:\.\d+)?$/.test(reps) ? `${reps}回` : reps);
  if(sets) a.push(/^\d+(?:\.\d+)?$/.test(sets) ? `${sets}セット` : sets);
  return a.join("・");
}
function line(exercise, text){
  const e = tidy(exercise);
  const t = tidy(text);
  return e && t ? `${e}：${t}` : (t || e);
}
function nextDiff(cur, nxt){
  const currentTop = cur.rows.slice(0, 3).map(r => `${tidy(r.exercise)} ${dose(r)}`.trim()).filter(Boolean);
  if(!nxt) return `次回方針：${currentTop.join("／")}を基準に、状態を確認して負荷・回数を調整。`;
  const before = new Map(cur.rows.map(r => [tidy(r.exercise), r]));
  const changes = [];
  nxt.rows.forEach(r => {
    const name = tidy(r.exercise);
    const old = before.get(name);
    if(!old) return;
    const a = dose(old), b = dose(r);
    if(a && b && a !== b) changes.push(`${name} ${a} → ${b}`);
  });
  if(changes.length) return `次回実績 ${nxt.date}：${changes.slice(0, 4).join("／")}${changes.length > 4 ? ` ほか${changes.length - 4}種目` : ""}`;
  const continued = nxt.rows.slice(0, 3).map(r => `${tidy(r.exercise)} ${dose(r)}`.trim()).filter(Boolean);
  return `次回実績 ${nxt.date}：${continued.join("／")}を継続。`;
}

export function buildLegacyNoteRepair(base, nameToId, splitMemo){
  const groups = new Map();
  (Array.isArray(base) ? base : []).forEach(r => {
    const clientId = nameToId(r?.client);
    const date = String(r?.date || "").slice(0, 10);
    if(!clientId || !date) return;
    const id = `legacy:${date}:${clientId}`;
    if(!groups.has(id)) groups.set(id, { id, clientId, date, rows: [], insight: [], caution: [], share: [], next: [], first: null });
    const g = groups.get(id);
    g.rows.push(r);
    const raw = tidy(r?.memo);
    if(!raw) return;
    const p = splitMemo(raw);
    if(!g.first) g.first = p;
    const explicit = /(気づき|注意点?|共有|次回)[:：]/.test(raw);
    if(explicit){
      addUnique(g.insight, line(r.exercise, p.insight));
      addUnique(g.caution, line(r.exercise, p.caution));
      addUnique(g.share, p.share);
      addUnique(g.next, p.next);
    }else if(cautionRe.test(raw)){
      addUnique(g.caution, line(r.exercise, raw));
    }else{
      addUnique(g.insight, line(r.exercise, raw));
    }
  });

  const byClient = new Map();
  groups.forEach(g => {
    if(!byClient.has(g.clientId)) byClient.set(g.clientId, []);
    byClient.get(g.clientId).push(g);
  });
  byClient.forEach(list => list.sort((a,b) => a.date.localeCompare(b.date)));

  const map = {};
  groups.forEach(g => {
    const list = byClient.get(g.clientId) || [];
    const pos = list.findIndex(x => x.id === g.id);
    const names = [...new Set(g.rows.map(r => tidy(r.exercise)).filter(Boolean))];
    const doses = g.rows.map(r => `${tidy(r.exercise)} ${dose(r)}`.trim()).filter(Boolean);
    const shared = g.share.length ? g.share : [`実施内容（${names.length}種目）：${doses.slice(0, 4).join("／")}${doses.length > 4 ? ` ほか${doses.length - 4}種目` : ""}`];
    const caution = g.caution.length ? g.caution : [`元記録に個別の注意記載なし。${doses.slice(0, 2).join("／")}を中心に、フォームと痛み・違和感の有無を確認。`];
    const nxt = g.next.length ? g.next : [nextDiff(g, list[pos + 1] || null)];
    map[g.id] = {
      first: g.first || { insight:"", caution:"", share:"", next:"" },
      notes: {
        insight: g.insight.join("\n"),
        caution: caution.join("\n"),
        share: shared.join("\n"),
        next: nxt.join("\n")
      }
    };
  });
  return map;
}

export function applyLegacyNoteRepair(sessions, repairMap){
  let fixed = 0;
  Object.values(sessions || {}).forEach(s => {
    if(s?.source !== "legacy") return;
    const rep = repairMap?.[s.id];
    if(!rep) return;
    const cur = s.notes || {};
    const first = rep.first || {};
    const stillAuto = (!cur.caution && !cur.share && !cur.next) ||
      JSON.stringify(cur) === JSON.stringify(first) ||
      /(気づき|注意点?|共有|次回)[:：]/.test(String(cur.insight || ""));
    if(!stillAuto) return; // v2画面で手入力済みのメモは守る
    if(JSON.stringify(cur) === JSON.stringify(rep.notes)) return;
    s.notes = { ...rep.notes };
    fixed += 1;
  });
  return fixed;
}
