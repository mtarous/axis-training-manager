/* data.enc から読んだ付随情報（目標・注意点・予定・カレンダー）。
   セッション中だけ持ち、保存はしない。中身は data.enc の更新でしか変わらない。 */

let meta = {};

export function setMeta(x){ meta = x && typeof x === "object" ? x : {} }
export function getMeta(){ return meta }
export function goalFor(name){ return String(meta.goals?.[name] || "") }
export function attentionFor(name){ return String(meta.attention?.[name] || "") }
