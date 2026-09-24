import test from 'node:test';
import assert from 'node:assert/strict';
import { googleCalendarUrl, plainParagraphs, relativeWhen } from '../lib/event-links';
const event = { id: 'e', name: 'Picnic Discussion', startAt: '2026-09-27T20:00:00.000Z', endAt: '2026-09-27T22:00:00.000Z', timezone: 'America/New_York', url: 'https://luma.com/x', location: 'Georgetown Waterfront Park' };
test('relative day labels follow the event time zone', () => {
  assert.equal(relativeWhen(event, Date.parse('2026-09-27T21:00:00Z')), 'Happening now');
  assert.equal(relativeWhen(event, Date.parse('2026-09-27T13:00:00Z')), 'Today');
  // 11 PM Sep 26 in DC is already Sep 27 in UTC, but the event is still tomorrow locally.
  assert.equal(relativeWhen(event, Date.parse('2026-09-27T03:00:00Z')), 'Tomorrow');
  assert.equal(relativeWhen(event, Date.parse('2026-09-24T15:00:00Z')), 'This Sunday');
  assert.equal(relativeWhen(event, Date.parse('2026-09-10T15:00:00Z')), 'In 17 days');
});
test('calendar link carries only public fields in UTC stamps', () => {
  const url = new URL(googleCalendarUrl(event));
  assert.equal(url.searchParams.get('dates'), '20260927T200000Z/20260927T220000Z');
  assert.equal(url.searchParams.get('location'), event.location);
});
test('markdown becomes plain paragraphs', () => {
  assert.deepEqual(plainParagraphs('## Hello\n\nJoin **us** at [the park](https://x.y).\n\n- bring water'), ['Hello', 'Join us at the park.', '• bring water']);
});
