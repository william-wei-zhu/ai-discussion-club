import test from 'node:test';
import assert from 'node:assert/strict';
import { projectPublicEvent, safePublicUrl } from '../lib/public-event-projection';
const source = { visibility: 'public', name: 'A real event', startAt: 1790539200000, url: 'https://luma.com/real', attendeeEmails: ['private@example.com'], directoryToken: 'secret' };
test('public event projection excludes private fields', () => {
  const projected = projectPublicEvent('id', source);
  assert.equal(projected?.name, source.name);
  assert.equal(projected?.startAt, '2026-09-27T20:00:00.000Z');
  assert.ok(!JSON.stringify(projected).includes('private@example.com'));
  assert.ok(!JSON.stringify(projected).includes('secret'));
});
test('unknown and private visibility fail closed', () => {
  for (const visibility of [undefined, null, 'private', 'unlisted', true]) assert.equal(projectPublicEvent('id', { ...source, visibility }), null);
});
test('unsafe URLs and malformed dates do not become public links', () => {
  for (const url of ['javascript:alert(1)', 'data:text/html,x', 'http://example.com']) {
    assert.equal(safePublicUrl(url), undefined);
    assert.equal(projectPublicEvent('id', { ...source, url }), null);
  }
  assert.equal(projectPublicEvent('id', { ...source, startAt: 'nonsense' }), null);
});
