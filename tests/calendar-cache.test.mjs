import assert from 'node:assert/strict';
import test from 'node:test';

const memory = new Map();
globalThis.localStorage = {
  getItem: key => memory.get(key) ?? null,
  setItem: (key, value) => memory.set(key, String(value)),
  removeItem: key => memory.delete(key)
};
const calendar = await import('../next/features/calendar.js');
const { getMeta, setMeta } = await import('../next/core/meta.js?v=21');
const oldCache = { events: [{ summary: 'Old calendar', start: '2026-10-14T10:00:00' }], syncedAt: '2026-10-13', calendarName: 'Old' };
function seed() {
  memory.clear(); setMeta({});
  localStorage.setItem('axis_v2_calendar', JSON.stringify({ endpoint: 'https://example.test/exec', token: 'test', calendarId: 'old' }));
  localStorage.setItem('axis_calendar_live_v1', JSON.stringify(oldCache));
  localStorage.setItem('axis_v2_state', 'existing training records');
}

test('legacy calendar cache remains available before any settings change', () => {
  seed();
  assert.equal(calendar.applyCached(), true);
  assert.deepEqual(getMeta().calendarEvents, oldCache.events);
});
for (const change of [{ calendarId: 'new' }, { endpoint: 'https://other.test/exec' }, { token: 'replacement' }]) {
  test('changing ' + Object.keys(change)[0] + ' cannot revive the old calendar cache after reload', () => {
    seed();
    calendar.saveSettings(change);
    setMeta({}); // A new app launch has no in-memory metadata.
    assert.equal(calendar.applyCached(), false);
    assert.equal(getMeta().calendarEvents, undefined);
    assert.equal(localStorage.getItem('axis_v2_state'), 'existing training records');
  });
}
test('explicit cache reset removes both generations without altering settings or records', () => {
  seed();
  localStorage.setItem('axis_v2_calendar_cache', JSON.stringify(oldCache));
  const settingsBefore = localStorage.getItem('axis_v2_calendar');
  calendar.clearCache();
  assert.equal(calendar.applyCached(), false);
  assert.equal(localStorage.getItem('axis_v2_calendar'), settingsBefore);
  assert.equal(localStorage.getItem('axis_v2_state'), 'existing training records');
});
