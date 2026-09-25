/**
 * AXIS TRAINING private sync server
 *
 * Bind this script to the private spreadsheet "AXIS_SYNC_PRIVATE".
 * Do not commit Spreadsheet IDs, deployment URLs, tokens or customer data.
 *
 * Client protocol:
 *   GET  ?op=health&token=...&callback=...
 *   GET  ?op=pull&token=...&callback=...
 *   GET  ?op=calendar&token=...&back=14&days=60&callback=...
 *   POST form fields:
 *     op=push
 *     token
 *     device_id
 *     payload_ciphertext
 *     iv_b64
 *     checksum
 *     schema_version
 *
 * The client encrypts data before upload. This script stores only ciphertext.
 */

const AXIS_SYNC_SERVER = {
  schemaVersion: 1,
  stateSheet: "sync_state",
  auditSheet: "audit_log",
  configSheet: "config",
  blobFolder: "AXIS_SYNC_PRIVATE_BLOBS",
  maxSnapshots: 40,
  pullSnapshots: 20,
  maxPayloadChars: 8 * 1024 * 1024
};

function doGet(e) {
  const p = (e && e.parameter) || {};
  const callback = String(p.callback || "");
  try {
    requireToken_(String(p.token || ""));
    const op = String(p.op || "health");
    let out;
    if (op === "health") {
      out = health_();
    } else if (op === "pull") {
      out = pull_();
    } else if (op === "calendar") {
      out = calendar_(p);
    } else {
      throw new Error("unsupported op");
    }
    return output_(out, callback);
  } catch (err) {
    return output_({ok:false,error:String(err && err.message || err)}, callback);
  }
}

function doPost(e) {
  try {
    const p = (e && e.parameter) || {};
    requireToken_(String(p.token || ""));
    const op = String(p.op || "");
    if (op !== "push") throw new Error("unsupported op");
    return output_(push_(p));
  } catch (err) {
    return output_({ok:false,error:String(err && err.message || err)});
  }
}

/**
 * Run once from the Apps Script editor.
 * Returns and logs a one-time plaintext sync token.
 * Only the SHA-256 hash is stored in Script Properties.
 *
 * If you lose the token, run axisRotateToken().
 */
function axisSetup() {
  ensureLayout_();
  ensureBlobFolder_();
  const props = PropertiesService.getScriptProperties();
  let token = "";
  if (!props.getProperty("AXIS_SYNC_TOKEN_SHA256")) {
    token = newToken_();
    props.setProperty("AXIS_SYNC_TOKEN_SHA256", sha256_(token));
  }

  setConfig_("schema_version", String(AXIS_SYNC_SERVER.schemaVersion), "AXIS sync storage schema");
  setConfig_("storage_mode", "encrypted_drive_blob", "Encrypted snapshot files in private Drive");
  setConfig_("owner_scope", "personal_drive", "Private sync storage");
  setConfig_("web_app_url", ScriptApp.getService().getUrl() || "", "Web app deployment URL");

  if (token) {
    Logger.log("AXIS_SYNC_TOKEN=" + token);
    return "AXIS_SYNC_TOKEN=" + token;
  }
  Logger.log("AXIS sync token already exists. If lost, run axisRotateToken().");
  return "token already exists";
}

function axisRotateToken() {
  ensureLayout_();
  const token = newToken_();
  PropertiesService.getScriptProperties().setProperty("AXIS_SYNC_TOKEN_SHA256", sha256_(token));
  audit_("server","rotate_token",0,"","ok","sync token rotated",AXIS_SYNC_SERVER.schemaVersion);
  Logger.log("AXIS_SYNC_TOKEN=" + token);
  return "AXIS_SYNC_TOKEN=" + token;
}

function health_() {
  ensureLayout_();
  const sh = sheet_(AXIS_SYNC_SERVER.stateSheet);
  const rows = Math.max(0, sh.getLastRow() - 1);
  return {
    ok:true,
    op:"health",
    schemaVersion:AXIS_SYNC_SERVER.schemaVersion,
    snapshotCount:rows,
    time:new Date().toISOString()
  };
}

/**
 * Google カレンダーの予定をそのまま返す。
 * どの予定をAXISに取り込むかの判定はクライアント側で行うため、
 * このスクリプトには利用者名などの顧客情報を持たせない。
 */
function calendar_(p) {
  const back = Math.min(90, Math.max(0, Number(p.back || 14) || 14));
  const days = Math.min(365, Math.max(1, Number(p.days || 90) || 90));
  const id = String(p.calendarId || "").trim();
  const cal = id ? CalendarApp.getCalendarById(id) : CalendarApp.getDefaultCalendar();
  if (!cal) throw new Error("calendar not found");
  const tz = Session.getScriptTimeZone() || "Asia/Tokyo";
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - back);
  const to = new Date(now.getFullYear(), now.getMonth(), now.getDate() + days);
  const events = cal.getEvents(from, to).map(function (ev) {
    return {
      id: String(ev.getId() || ""),
      summary: String(ev.getTitle() || ""),
      start: Utilities.formatDate(ev.getStartTime(), tz, "yyyy-MM-dd'T'HH:mm:ss"),
      end: Utilities.formatDate(ev.getEndTime(), tz, "yyyy-MM-dd'T'HH:mm:ss"),
      allDay: ev.isAllDayEvent()
    };
  });
  return {
    ok: true,
    syncedAt: Utilities.formatDate(now, tz, "yyyy-MM-dd HH:mm:ss"),
    calendar: String(cal.getName() || ""),
    count: events.length,
    events: events
  };
}

function pull_() {
  ensureLayout_();
  const sh = sheet_(AXIS_SYNC_SERVER.stateSheet);
  const lastRow = sh.getLastRow();
  if (lastRow < 2) {
    return {ok:true,op:"pull",snapshots:[],latestRevision:0};
  }

  const rows = sh.getRange(2,1,lastRow-1,8).getValues()
    .filter(function(r){ return String(r[1] || "").trim(); })
    .sort(function(a,b){ return Number(b[3]||0)-Number(a[3]||0); })
    .slice(0,AXIS_SYNC_SERVER.pullSnapshots);

  const out = [];
  rows.forEach(function(r){
    try {
      const ref = String(r[1] || "");
      const file = DriveApp.getFileById(ref);
      const blob = JSON.parse(file.getBlob().getDataAsString("UTF-8"));
      out.push({
        snapshot_id:String(r[0]||""),
        payload_ciphertext:String(blob.payload_ciphertext||""),
        iv_b64:String(blob.iv_b64||""),
        updated_at:String(r[2]||""),
        revision:Number(r[3]||0),
        device_id:String(r[4]||""),
        checksum:String(r[5]||""),
        schema_version:Number(r[6]||1),
        size_bytes:Number(r[7]||0)
      });
    } catch (err) {
      audit_("server","pull_read_error",Number(r[3]||0),String(r[5]||""),"error",String(err),AXIS_SYNC_SERVER.schemaVersion);
    }
  });

  return {
    ok:true,
    op:"pull",
    snapshots:out,
    latestRevision:out.reduce(function(m,x){return Math.max(m,Number(x.revision)||0);},0)
  };
}

function push_(p) {
  ensureLayout_();

  const payload = String(p.payload_ciphertext || "");
  const iv = String(p.iv_b64 || "");
  const checksum = String(p.checksum || "");
  const deviceId = String(p.device_id || "").slice(0,120);
  const schemaVersion = Number(p.schema_version || 0);

  if (!payload || !iv || !checksum || !deviceId) throw new Error("missing push fields");
  if (schemaVersion !== AXIS_SYNC_SERVER.schemaVersion) throw new Error("schema mismatch");
  if (payload.length > AXIS_SYNC_SERVER.maxPayloadChars) throw new Error("snapshot too large");

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);

  try {
    const sh = sheet_(AXIS_SYNC_SERVER.stateSheet);
    const lastRow = sh.getLastRow();
    let latestRevision = 0;
    let latestChecksum = "";

    if (lastRow >= 2) {
      const rows = sh.getRange(2,1,lastRow-1,8).getValues();
      rows.forEach(function(r){
        const rev = Number(r[3]||0);
        if (rev >= latestRevision) {
          latestRevision = rev;
          latestChecksum = String(r[5]||"");
        }
      });
    }

    if (latestChecksum && latestChecksum === checksum) {
      audit_(deviceId,"push_duplicate",latestRevision,checksum,"ok","same encrypted snapshot",schemaVersion);
      return {ok:true,op:"push",duplicate:true,revision:latestRevision,checksum:checksum};
    }

    const revision = latestRevision + 1;
    const snapshotId = Utilities.getUuid();
    const blobBody = JSON.stringify({
      payload_ciphertext:payload,
      iv_b64:iv,
      checksum:checksum,
      schema_version:schemaVersion
    });

    const fileName = "snapshot_" + String(revision).padStart(6,"0") + "_" + snapshotId + ".json";
    const file = ensureBlobFolder_().createFile(fileName, blobBody, MimeType.PLAIN_TEXT);
    const updatedAt = new Date().toISOString();

    sh.appendRow([
      snapshotId,
      file.getId(),
      updatedAt,
      revision,
      deviceId,
      checksum,
      schemaVersion,
      blobBody.length
    ]);

    audit_(deviceId,"push",revision,checksum,"ok","snapshot appended",schemaVersion);
    cleanup_();

    return {ok:true,op:"push",duplicate:false,revision:revision,checksum:checksum};
  } finally {
    lock.releaseLock();
  }
}

function ensureLayout_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureSheet_(
    ss,
    AXIS_SYNC_SERVER.stateSheet,
    ["snapshot_id","payload_ref","updated_at","revision","device_id","checksum","schema_version","size_bytes"]
  );
  ensureSheet_(
    ss,
    AXIS_SYNC_SERVER.auditSheet,
    ["timestamp","device_id","action","revision","checksum","status","note","schema_version"]
  );
  ensureSheet_(
    ss,
    AXIS_SYNC_SERVER.configSheet,
    ["key","value","description","updated_at"]
  );
}

function ensureSheet_(ss,name,headers) {
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);

  if (sh.getMaxColumns() < headers.length) {
    sh.insertColumnsAfter(sh.getMaxColumns(), headers.length-sh.getMaxColumns());
  }

  const current = sh.getRange(1,1,1,headers.length).getValues()[0];
  const mismatch = headers.some(function(h,i){ return String(current[i]||"") !== h; });

  if (mismatch) {
    const hasData = sh.getLastRow() > 1 && sh.getRange(2,1,sh.getLastRow()-1,Math.min(headers.length,sh.getMaxColumns()))
      .getValues().some(function(row){ return row.some(function(v){ return String(v||"").trim() !== ""; }); });

    if (hasData && name === AXIS_SYNC_SERVER.stateSheet) {
      throw new Error("sync_state header mismatch with existing data");
    }
    sh.getRange(1,1,1,headers.length).setValues([headers]);
  }

  sh.setFrozenRows(1);
  sh.getRange(1,1,1,headers.length).setFontWeight("bold");
  return sh;
}

function ensureBlobFolder_() {
  const ssFile = DriveApp.getFileById(SpreadsheetApp.getActiveSpreadsheet().getId());
  const parents = ssFile.getParents();
  const parent = parents.hasNext() ? parents.next() : DriveApp.getRootFolder();
  const found = parent.getFoldersByName(AXIS_SYNC_SERVER.blobFolder);
  return found.hasNext() ? found.next() : parent.createFolder(AXIS_SYNC_SERVER.blobFolder);
}

function cleanup_() {
  const sh = sheet_(AXIS_SYNC_SERVER.stateSheet);
  const count = Math.max(0, sh.getLastRow()-1);
  if (count <= AXIS_SYNC_SERVER.maxSnapshots) return;

  const extra = count - AXIS_SYNC_SERVER.maxSnapshots;
  const old = sh.getRange(2,1,extra,8).getValues();

  old.forEach(function(r){
    try {
      if (r[1]) DriveApp.getFileById(String(r[1])).setTrashed(true);
    } catch (_) {}
  });

  sh.deleteRows(2,extra);
}

function requireToken_(token) {
  ensureLayout_();
  const expectedHash = PropertiesService.getScriptProperties().getProperty("AXIS_SYNC_TOKEN_SHA256");
  if (!expectedHash) throw new Error("sync token not initialized; run axisSetup()");
  if (!token || sha256_(token) !== expectedHash) throw new Error("unauthorized");
}

function newToken_() {
  return Utilities.base64EncodeWebSafe(
    Utilities.computeDigest(
      Utilities.DigestAlgorithm.SHA_256,
      Utilities.newBlob(Utilities.getUuid()+Utilities.getUuid()+String(new Date().getTime())).getBytes()
    )
  ).replace(/=+$/,"");
}

function sha256_(text) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,String(text))
    .map(function(b){ const n=(b<0?b+256:b); return ("0"+n.toString(16)).slice(-2); })
    .join("");
}

function sheet_(name) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!sh) throw new Error("missing sheet: "+name);
  return sh;
}

function setConfig_(key,value,description) {
  const sh = sheet_(AXIS_SYNC_SERVER.configSheet);
  const lastRow = sh.getLastRow();

  if (lastRow >= 2) {
    const keys = sh.getRange(2,1,lastRow-1,1).getValues().map(function(r){return String(r[0]||"");});
    const idx = keys.indexOf(key);
    if (idx >= 0) {
      sh.getRange(idx+2,1,1,4).setValues([[
        key,String(value||""),String(description||""),new Date().toISOString()
      ]]);
      return;
    }
  }

  sh.appendRow([key,String(value||""),String(description||""),new Date().toISOString()]);
}

function audit_(deviceId,action,revision,checksum,status,note,schemaVersion) {
  try {
    sheet_(AXIS_SYNC_SERVER.auditSheet).appendRow([
      new Date().toISOString(),
      String(deviceId||""),
      String(action||""),
      Number(revision||0),
      String(checksum||""),
      String(status||""),
      String(note||"").slice(0,500),
      Number(schemaVersion||AXIS_SYNC_SERVER.schemaVersion)
    ]);
  } catch (_) {}
}

function output_(obj,callback) {
  const text = JSON.stringify(obj);
  if (callback && /^[A-Za-z_$][0-9A-Za-z_$]{0,120}$/.test(callback)) {
    return ContentService.createTextOutput(callback+"("+text+");")
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(text)
    .setMimeType(ContentService.MimeType.JSON);
}
