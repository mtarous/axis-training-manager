/* 過去の記録（data.enc）の読み込み。
   アクセスコードが要るのはここだけ。
   アプリで入力した記録はこの端末の中にあるので、コードが無くても使える。 */

import { decryptBlob } from "./crypto.js?v=14";
import { getMeta, setMeta } from "./meta.js?v=14";
import { importLegacy, resplitLegacyNotes, repairLegacyNotes } from "./migrate.js?v=15";
import * as store from "./store.js?v=14";

const KEY_CODE = "axis_training_key";

/* 暗号化データはリポジトリの一番上にある。
   このHTMLがどこに置かれても同じ場所を指すよう、モジュールの位置から数える。 */
const dataURL = name => new URL("../../" + name, import.meta.url).href;

let loaded = false;
export function isLoaded(){ return loaded }
export function savedCode(){ return localStorage.getItem(KEY_CODE) || "" }
export function forgetCode(){ localStorage.removeItem(KEY_CODE) }

/* コードを入れて、過去の記録とカレンダーを読み込む */
export async function load(code, { remember = true } = {}){
  const data = await decryptBlob(dataURL("data.enc"), code);
  setMeta({ ...getMeta(), ...data });
  try{
    const cal = await decryptBlob(dataURL("calendar-current.enc"), code);
    setMeta({ ...getMeta(), calendarEvents: cal.events || [], calendarSyncedAt: cal.syncedAt || "" });
  }catch(e){ /* カレンダーが読めなくても記録は使える */ }

  const imported = importLegacy({ base: data.history || [], meta: data });
  const added = store.mergeImported(imported);
  store.repair(sessions => repairLegacyNotes(sessions, imported.noteRepair));
  store.repair(resplitLegacyNotes);
  if(remember) localStorage.setItem(KEY_CODE, code);
  loaded = true;
  return added;
}

/* コード無しで始める。この端末に残っている入力分だけを引き継ぐ。 */
export function loadLocalOnly(){
  const added = store.mergeImported(importLegacy({ base: [], meta: getMeta() }));
  store.repair(resplitLegacyNotes);
  return added;
}
