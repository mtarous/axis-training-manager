/* Training-only presentation layer. Keep the existing draft/session schema. */
(function () {
  'use strict';
  const previousRender = window.renderInput;
  const previousClock = window.updateSessionClock;
  const previousTick = window.tick;
  const previousStartTimer = window.startTimer;
  let restDuration = 0, restDeadline = 0, finishing = false, sessionOwner = '';
  const previousSessionStart = window.startSession40;
  window.startSession40 = function () {
    const owner = $('#fclient')?.value || '';
    if (sessionOwner && owner !== sessionOwner) { resetSession40(); v16StopRest(); }
    sessionOwner = owner;
    previousSessionStart();
  };
  const time = s => `${Math.floor(Math.max(0, s) / 60)}:${String(Math.floor(Math.max(0, s) % 60)).padStart(2, '0')}`;
  const button = (label, action, cls = '') => `<button type="button" class="ax16t-btn ${cls}" onclick="${action}">${label}</button>`;
  function historyRows() {
    const client = $('#fclient').value, date = $('#fdate').value, exercise = exs[activeExerciseIndex]?.exercise;
    return all().filter(r => r.client === client && r.exercise === exercise && r.date < date).sort((a, b) => b.date.localeCompare(a.date));
  }
  window.renderInput = function (p = {}) {
    previousRender(p);
    const root = $('#input');
    root.classList.add('ax16-training');
    // The old renderer omits RPE and resets status on every redraw.
    const rpe = document.createElement('input');
    rpe.type = 'hidden'; rpe.id = 'frpe'; rpe.value = p.rpe ?? '';
    root.appendChild(rpe);
    $('#fstatus').value = p.status || '完了';
    root.insertAdjacentHTML('afterbegin', `<header class="ax16t-header">${button('‹ 戻る', "saveDraft();show('home')")}<div class="ax16-logo">A<i>X</i>IS<small>TRAINING</small></div>${button('セッション終了', 'v16Finish()')}</header>`);
    root.querySelector('.timerbar').hidden = true;
    const memo = root.querySelector('.ax-memo');
    memo.querySelectorAll('.ax-memo-btn').forEach((b, i) => {
      b.removeAttribute('onclick');
      b.onclick = () => { const field = $(`#${['finsight', 'fcaution', 'fshare'][i]}`); const details = field.closest('details'); if (details) details.open = true; field.focus(); };
    });
    memo.querySelector('button[onclick="save()"]').setAttribute('onclick', 'v16Finish()');
    $('#fclient').setAttribute('aria-label', 'クライアント');
    if (sessionOwner && sessionOwner !== $('#fclient').value) { resetSession40(); v16StopRest(); sessionOwner = ''; }
    drawEx(); updateSessionClock();
  };
  window.drawEx = function () {
    if (!$('#editors')) return;
    activeExerciseIndex = Math.max(0, Math.min(activeExerciseIndex, exs.length - 1));
    const i = activeExerciseIndex, e = exs[i];
    if (!e) { $('#editors').innerHTML = button('＋ 種目を追加', 'addEx()'); return; }
    const body = String(e.weight) === '自重', rpe = $('#frpe')?.value || '', rows = historyRows(), prev = rows[0];
    function control(label, value, minus, plus) {
      return `<div class="ax16t-control"><label>${label}</label><div class="ax16t-step">${button('−', minus)}<strong>${value}</strong>${button('＋', plus)}</div></div>`;
    }
    $('#editors').innerHTML = `<div class="ax16t-panel">
      <div class="ax16t-row"><h2>現在の種目</h2><span>${i + 1} / ${exs.length}</span><div>${button('‹', 'axisPrevExercise()')}${button('›', 'axisNextExercise()')}</div></div>
      <div class="ax16t-exercise"><div><select aria-label="種目" onchange="chooseExercise(${i},this.value)">${exerciseOptions(e.exercise)}</select><div class="ax16-chips">${musclesForExercise(e.exercise).map(m => `<span class="ax16-chip">${esc(m)}</span>`).join('')}</div></div><div class="ax16t-anatomy">${muscleMap([e], {chips:false})}</div></div>
      <div class="ax16t-controls"><div class="ax16t-control"><label>重量 (kg)</label><div class="ax16t-step">${button('−', `stepW(${i},-1)`)}<strong>${body ? '自重' : Number(e.weight || 0).toFixed(1)}</strong>${button('＋', `stepW(${i},1)`)}</div><div class="ax16t-chips">${[-1, -.5, .5, 1].map(d => button(`${d > 0 ? '+' : ''}${d}`, `axisAdjustWeight(${i},${d})`)).join('')}</div>${button(body ? '重量へ' : '自重', body ? `setWeightStep(${i},1)` : `setBodyWeight(${i})`)}</div>
      ${control('回数', esc(e.reps), `stepR(${i},-1)`, `stepR(${i},1)`)}
      ${control('予定セット数', esc(e.sets), `changeSets(${i},-1)`, `changeSets(${i},1)`)}
      ${control('RPE · セッション全体', esc(rpe || '未入力'), 'axisStepRPE(-1)', 'axisStepRPE(1)')}</div>
      <div class="ax16t-previous"><span>前回の結果${prev ? ' · ' + esc(prev.date) : ''}</span><strong>${prev ? `${esc(prev.weight)}${Number.isFinite(Number(prev.weight)) ? ' kg' : ''} × ${esc(prev.reps)}回 × ${esc(prev.sets)}セット` : 'この種目の過去記録はありません'}</strong><details><summary>履歴を表示（${rows.length}件）</summary>${rows.map(r => `<p>${esc(r.date)} · ${esc(r.weight)} × ${esc(r.reps)}回 × ${esc(r.sets)}セット</p>`).join('')}</details></div>
      <div class="ax16t-actions">${button('✓ このセットを記録する', `completeNextSet(${i})`, 'primary')}${button('直前の完了を取り消す', `v16UndoSet(${i})`)}</div>
      <div class="ax16t-lower"><div id="v16Rest"></div><div class="ax16t-setlist"><h3>セット状況 ${e.done.length} / ${e.sets}</h3><p class="ax16t-muted">重量・回数は種目内で共通</p>${Array.from({length:Number(e.sets)}, (_, j) => button(`<span>${j + 1}</span><span>${e.done.includes(j) ? '完了' : '未記録'}</span><span>${e.done.includes(j) ? '✓' : '○'}</span>`, `toggleSet(${i},${j})`, `ax16t-set ${e.done.includes(j) ? 'done' : ''}`)).join('')}</div></div>
      <div class="ax16t-actions">${button('＋ 種目を追加', 'addEx();activeExerciseIndex=exs.length-1;drawEx()')}${button('この種目を削除', `v16RemoveExercise(${i})`)}</div></div>`;
    const oldRest = $('#smartRest'); if (oldRest) oldRest.hidden = true;
    showSmartRest(i);
  };
  window.v16UndoSet = function (i) {
    const done = exs[i].done; if (done.length) toggleSet(i, done[done.length - 1]);
  };
  window.v16RemoveExercise = function (i) {
    if (confirm('この種目を入力中のメニューから削除しますか？')) removeEx(i);
  };
  window.showSmartRest = function (i) {
    const box = $('#v16Rest'), e = exs[i]; if (!box || !e) return;
    const sec = smartRestSeconds(e, $('#fclient')?.value || '', $('#frpe')?.value || '');
    box.innerHTML = `<h3>スマート休憩</h3><div class="ax16t-rest"><div class="ax16t-ring"><svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="52"/><circle id="v16RestArc" cx="60" cy="60" r="52" pathLength="100"/></svg><div><span id="v16RestLabel">推奨休憩</span><strong id="v16RestTime">${time(sec)}</strong></div></div><div><p class="ax16t-muted">種目・回数・RPE・前回重量から算出<br>推奨 ${time(sec)}</p>${button('▶ 休憩スタート', `startTimer(${sec})`, 'primary')}${button('休憩を終了', 'v16StopRest()')}</div></div>`;
    paintRest();
  };
  function paintRest() {
    if (!restDuration || !$('#v16RestTime')) return;
    const left = Math.max(0, Math.ceil((restDeadline - Date.now()) / 1000));
    $('#v16RestTime').textContent = time(left);
    $('#v16RestLabel').textContent = left ? '休憩中' : '休憩終了';
    $('#v16RestArc').style.strokeDashoffset = String(100 * (1 - left / restDuration));
  }
  window.startTimer = function (sec) {
    restDuration = sec; restDeadline = Date.now() + sec * 1000;
    previousStartTimer(sec); paintRest();
  };
  window.tick = function () {
    if (restDeadline) timerLeft = Math.max(0, Math.ceil((restDeadline - Date.now()) / 1000));
    previousTick(); paintRest();
  };
  window.v16StopRest = function () {
    clearInterval(timerId); timerLeft = 0; restDeadline = 0; restDuration = 0;
    showSmartRest(activeExerciseIndex);
  };
  window.updateSessionClock = function () {
    previousClock();
    const clock = $('#session40'), state = getSession40State();
    if (!clock) return;
    const elapsed = state.startedAt ? Math.floor((Date.now() - state.startedAt) / 1000) : 0;
    clock.innerHTML = `<div class="ax16t-clock"><span>セッション経過 <b>${time(elapsed)} / 40:00</b></span><strong>残り ${time(2400 - elapsed)}</strong><progress max="2400" value="${Math.min(2400, elapsed)}" aria-label="セッション経過"></progress>${state.startedAt ? '' : button('40分セッション開始', 'startSession40()')}</div>`;
  };
  window.v16Finish = function () {
    if (finishing) return;
    const d = currentDraft(), count = d.exercises.reduce((sum, e) => sum + e.done.length, 0);
    if (!d.client || !d.date || !d.exercises.some(e => e.exercise)) { alert('日付・利用者・メニューを入力してください'); return; }
    if (!confirm(`${d.client} · ${d.date}\n完了 ${count}セット\n現在の入力内容を保存してセッションを終了しますか？`)) return;
    finishing = true;
    try {
      save();
      if (draft === null) { resetSession40(); v16StopRest(); }
    } finally { finishing = false; }
  };
})();
