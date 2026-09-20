/**
 * AXIS TRAINING private sync API
 * Bind this script to the private spreadsheet "AXIS_SYNC_PRIVATE".
 *
 * Security model:
 * - Deploy as Web app: Execute as "Me".
 * - Client data is encrypted in the browser before upload.
 * - A private sync token is required for every pull/push.
 * - The public GitHub repository never contains Sheet IDs, deployment URLs or tokens.
 */

const AXIS_SYNC = {
  schema: 1,
  stateSheet: "sync_state",
  auditSheet: "audit_log",
  configSheet: "config",
  blobFolder: "AXIS_SYNC_PRIVATE_BLOBS",
  maxSnapshots: 40,
  pullLimit: 20,
  maxCipherChars: 8 * 1024 * 1024
};

function doGet(e) {
  try {
    const p = (e && e.parameter) || {};
    const callback = String(p.callback || "");
    const action = String(p.action || "ping");
    requireSyncToken_(String(p.key || ""));
    let out;
    if (action === "ping") out = {ok:true, action:"ping", schema:AXIS_SYNC.schema, time:new Date().toISOString()};
    else if (action === "pull") out = pullSnapshots_(Number(p.limit || AXIS_SYNC.pullLimit));
    else throw new Error("unsupported action");
    return output_(out, callback);
  } catch (err) {
    return output_({ok:false,error:String(err && err.message || err)}, String((e && e.parameter && e.parameter.callback) || ""));
  }
}

function doPost(e) {
  try {
    const raw = String((e && e.postData && e.postData.contents) || "");
    const req = JSON.parse(raw || "{}");
    requireSyncToken_(String(req.key || ""));
    if (req.action !== "push") throw new Error("unsupported action");
    return output_(pushSnapshot_(req));
  } catch (err) {
    return output_({ok:false,error:String(err && err.message || err)});
  }
}

/**
 * Run once from the Apps Script editor before/after deployment.
 * It prepares sheets/folder and creates a private sync token if missing.
 * The token is written only to the private config sheet.
 */
function setupAxisSync() {
  ensureLayout_();
  const token = getConfig_("sync_token") || createToken_();
  if (!getConfig_("sync_token")) setConfig_("sync_token", token, "Private API token. Do not publish.");
  const url = ScriptApp.getService().getUrl() || "";
  setConfig_("web_app_url", url, "Web app deployment URL");
  setConfig_("schema_version", String(AXIS_SYNC.schema), "AXIS sync storage schema");
  setConfig_("storage_mode", "encrypted_drive_blob", "Only encrypted snapshots are stored");
  setConfig_("owner_scope", "personal_drive", "Private AXIS sync storage");
  ensureBlobFolder_();
  SpreadsheetApp.flush();
  Logger.log("AXIS sync prepared. Copy web_app_url and sync_token from the private config sheet.");
  return {ok:true, web_app_url:url, token_created:!!token};
}

function pullSnapshots_(limit) {
  ensureLayout_();
  const sh = sheet_(AXIS_SYNC.stateSheet);
  const last = sh.getLastRow();
  if (last < 2) return {ok:true, action:"pull", schema:AXIS_SYNC.schema, snapshots:[], latestRevision:0};
  const values = sh.getRange(2,1,last-1,8).getValues()
    .filter(r => String(r[1] || "").trim())
    .sort((a,b) => Number(b[3]||0) - Number(a[3]||0))
    .slice(0, Math.max(1, Math.min(Number(limit)||AXIS_SYNC.pullLimit, AXIS_SYNC.pullLimit)));

  const snapshots = [];
  for (const r of values) {
    try {
      const file = DriveApp.getFileById(String(r[1]));
      const blob = JSON.parse(file.getBlob().getDataAsString("UTF-8"));
      snapshots.push({
        snapshot_id:String(r[0]||""),
        updated_at:String(r[2]||""),
        revision:Number(r[3]||0),
        device_id:String(r[4]||""),
        checksum:String(r[5]||""),
        schema_version:Number(r[6]||1),
        size_bytes:Number(r[7]||0),
        ct:String(blob.ct||""),
        iv:String(blob.iv||""),
        zip:String(blob.zip||"none")
      });
    } catch (err) {
      audit_("server","pull_read_error",Number(r[3]||0),String(r[5]||""),"error",String(err),AXIS_SYNC.schema);
    }
  }
  return {
    ok:true, action:"pull", schema:AXIS_SYNC.schema,
    snapshots:snapshots,
    latestRevision:snapshots.reduce((m,x)=>Math.max(m,x.revision||0),0)
  };
}

function pushSnapshot_(req) {
  ensureLayout_();
  const ct = String(req.ct || "");
  const iv = String(req.iv || "");
  const zip = String(req.zip || "none");
  const checksum = String(req.checksum || "");
  const deviceId = String(req.device_id || "").slice(0,120);
  const schema = Number(req.schema_version || 1);
  if (!ct || !iv || !checksum || !deviceId) throw new Error("missing snapshot fields");
  if (ct.length > AXIS_SYNC.maxCipherChars) throw new Error("snapshot too large");
  if (!/^[A-Za-z0-9+/_=-]+$/.test(ct) || !/^[A-Za-z0-9+/_=-]+$/.test(iv)) throw new Error("invalid encoding");
  if (schema !== AXIS_SYNC.schema) throw new Error("schema mismatch");

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sh = sheet_(AXIS_SYNC.stateSheet);
    const last = sh.getLastRow();
    let latestRevision = 0, latestChecksum = "";
    if (last >= 2) {
      const rows = sh.getRange(2,1,last-1,8).getValues();
      rows.forEach(r => {
        const rev = Number(r[3]||0);
        if (rev >= latestRevision) { latestRevision = rev; latestChecksum = String(r[5]||""); }
      });
    }
    if (latestChecksum && latestChecksum === checksum) {
      audit_(deviceId,"push_duplicate",latestRevision,checksum,"ok","same state",schema);
      return {ok:true, action:"push", duplicate:true, revision:latestRevision, checksum:checksum};
    }

    const revision = latestRevision + 1;
    const snapshotId = Utilities.getUuid();
    const payload = JSON.stringify({ct:ct,iv:iv,zip:zip,checksum:checksum,schema_version:schema});
    const fileName = "snapshot_" + String(revision).padStart(6,"0") + "_" + snapshotId + ".json";
    const file = ensureBlobFolder_().createFile(fileName, payload, MimeType.PLAIN_TEXT);
    const now = new Date().toISOString();
    sh.appendRow([snapshotId,file.getId(),now,revision,deviceId,checksum,schema,payload.length]);
    audit_(deviceId,"push",revision,checksum,"ok","snapshot appended",schema);
    cleanupSnapshots_();
    return {ok:true, action:"push", duplicate:false, revision:revision, checksum:checksum};
  } finally {
    lock.releaseLock();
  }
}

function cleanupSnapshots_() {
  const sh = sheet_(AXIS_SYNC.stateSheet);
  const count = Math.max(0, sh.getLastRow()-1);
  if (count <= AXIS_SYNC.maxSnapshots) return;
  const extra = count - AXIS_SYNC.maxSnapshots;
  const old = sh.getRange(2,1,extra,8).getValues();
  old.forEach(r => {
    try { if (r[1]) DriveApp.getFileById(String(r[1])).setTrashed(true); } catch (_) {}
  });
  sh.deleteRows(2, extra);
}

function ensureLayout_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureSheet_(ss, AXIS_SYNC.stateSheet, ["snapshot_id","payload_ref","updated_at","revision","device_id","checksum","schema_version","size_bytes"]);
  ensureSheet_(ss, AXIS_SYNC.auditSheet, ["timestamp","device_id","action","revision","checksum","status","note","schema_version"]);
  ensureSheet_(ss, AXIS_SYNC.configSheet, ["key","value","description","updated_at"]);
}

function ensureSheet_(ss,name,headers) {
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  if (sh.getMaxColumns() < headers.length) sh.insertColumnsAfter(sh.getMaxColumns(), headers.length-sh.getMaxColumns());
  const current = sh.getRange(1,1,1,headers.length).getValues()[0];
  if (headers.some((h,i)=>String(current[i]||"") !== h)) sh.getRange(1,1,1,headers.length).setValues([headers]);
  sh.setFrozenRows(1);
  sh.getRange(1,1,1,headers.length).setFontWeight("bold");
  return sh;
}

function sheet_(name) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!sh) throw new Error("missing sheet: " + name);
  return sh;
}

function ensureBlobFolder_() {
  const ssFile = DriveApp.getFileById(SpreadsheetApp.getActiveSpreadsheet().getId());
  const parents = ssFile.getParents();
  const parent = parents.hasNext() ? parents.next() : DriveApp.getRootFolder();
  const existing = parent.getFoldersByName(AXIS_SYNC.blobFolder);
  return existing.hasNext() ? existing.next() : parent.createFolder(AXIS_SYNC.blobFolder);
}

function getConfig_(key) {
  const sh = sheet_(AXIS_SYNC.configSheet);
  const last = sh.getLastRow();
  if (last < 2) return "";
  const rows = sh.getRange(2,1,last-1,4).getValues();
  const row = rows.find(r => String(r[0]||"") === key);
  return row ? String(row[1]||"") : "";
}

function setConfig_(key,value,description) {
  const sh = sheet_(AXIS_SYNC.configSheet);
  const last = sh.getLastRow();
  if (last >= 2) {
    const keys = sh.getRange(2,1,last-1,1).getValues().map(r=>String(r[0]||""));
    const idx = keys.indexOf(key);
    if (idx >= 0) {
      sh.getRange(idx+2,1,1,4).setValues([[key,String(value||""),String(description||""),new Date().toISOString()]]);
      return;
    }
  }
  sh.appendRow([key,String(value||""),String(description||""),new Date().toISOString()]);
}

function requireSyncToken_(given) {
  ensureLayout_();
  const expected = getConfig_("sync_token");
  if (!expected) throw new Error("sync token not initialized; run setupAxisSync()");
  if (!given || given !== expected) throw new Error("unauthorized");
}

function createToken_() {
  return Utilities.base64EncodeWebSafe(
    Utilities.computeDigest(
      Utilities.DigestAlgorithm.SHA_256,
      Utilities.newBlob(Utilities.getUuid()+Utilities.getUuid()+new Date().getTime()).getBytes()
    )
  ).replace(/=+$/,"");
}

function audit_(device,action,revision,checksum,status,note,schema) {
  try {
    sheet_(AXIS_SYNC.auditSheet).appendRow([
      new Date().toISOString(), String(device||""), String(action||""), Number(revision||0),
      String(checksum||""), String(status||""), String(note||"").slice(0,500), Number(schema||1)
    ]);
  } catch (_) {}
}

function output_(obj,callback) {
  const text = JSON.stringify(obj);
  if (callback && /^[A-Za-z_$][0-9A-Za-z_$\.]{0,120}$/.test(callback)) {
    return ContentService.createTextOutput(callback+"("+text+");").setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(text).setMimeType(ContentService.MimeType.JSON);
}
