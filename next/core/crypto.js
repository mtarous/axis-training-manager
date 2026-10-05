/* data.enc / calendar*.enc の復号。鍵はアクセスコードから毎回導出し、保持しない。 */

const b64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));

export async function decryptBlob(path, passphrase){
  const res = await fetch(path, {cache:"no-store"});
  if(!res.ok) throw new Error("読み込めません: " + path);
  const blob = await res.json();
  const te = new TextEncoder();
  const km = await crypto.subtle.importKey("raw", te.encode(passphrase), "PBKDF2", false, ["deriveKey"]);
  const key = await crypto.subtle.deriveKey(
    {name:"PBKDF2", salt:b64(blob.salt), iterations:blob.iter, hash:"SHA-256"},
    km, {name:"AES-GCM", length:256}, false, ["decrypt"]
  );
  const pt = await crypto.subtle.decrypt(
    {name:"AES-GCM", iv:b64(blob.nonce), additionalData:te.encode(blob.aad)},
    key, b64(blob.ct)
  );
  return JSON.parse(new TextDecoder().decode(pt));
}
