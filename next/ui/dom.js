/* 画面を書くための小さな道具。 */

export const el  = s => document.querySelector(s);
export const els = s => [...document.querySelectorAll(s)];

export function esc(v){
  return String(v ?? "").replace(/[&<>"']/g, m =>
    ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[m]));
}

export function html(node, markup){ if(node) node.innerHTML = markup }

/* 画面下に重ねるバーの置き場。休憩バーと取り消しバーが重ならないようにする。 */
export function dock(){
  let d = el("#ax-dock");
  if(!d){
    d = document.createElement("div");
    d.id = "ax-dock";
    d.className = "ax-dock";
    document.body.appendChild(d);
  }
  return d;
}

/* 取り消しつきの通知。消したとき・保存したときに出す。 */
let toastTimer = null;
export function toast(message, { detail = "", actionLabel = "", onAction = null, seconds = 30 } = {}){
  closeToast();
  const box = document.createElement("div");
  box.id = "ax-toast";
  box.className = "ax-bar ax-toast";
  box.innerHTML =
    '<span><b>' + esc(message) + '</b>' + (detail ? '<small>' + esc(detail) + '</small>' : '') + '</span>' +
    (actionLabel ? '<button type="button" class="ax-toast-act"></button>' : '') +
    '<button type="button" class="ax-toast-close" aria-label="閉じる">×</button>';
  if(actionLabel){
    const b = box.querySelector(".ax-toast-act");
    b.textContent = actionLabel;
    b.addEventListener("click", () => { closeToast(); onAction && onAction() });
  }
  box.querySelector(".ax-toast-close").addEventListener("click", closeToast);
  dock().prepend(box);
  toastTimer = setTimeout(closeToast, seconds * 1000);
}
export function closeToast(){
  if(toastTimer){ clearTimeout(toastTimer); toastTimer = null }
  el("#ax-toast")?.remove();
}

/* 数字をタップしてその場で打ち直す。 */
export function inlineEdit(node, current, commit){
  if(node.querySelector("input")) return;
  const input = document.createElement("input");
  input.type = "text";
  input.inputMode = "decimal";
  input.className = "ax-inline";
  input.value = String(current);
  node.innerHTML = "";
  node.appendChild(input);
  input.focus();
  input.select();

  let closed = false;
  const finish = ok => {
    if(closed) return;
    closed = true;
    const v = parseFloat(input.value);
    commit(ok && Number.isFinite(v) ? Math.max(0, Math.round(v * 10) / 10) : null);
  };
  input.addEventListener("blur", () => finish(true));
  input.addEventListener("keydown", e => {
    if(e.key === "Enter"){ e.preventDefault(); finish(true) }
    if(e.key === "Escape"){ e.preventDefault(); finish(false) }
  });
}
