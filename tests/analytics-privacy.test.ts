import test from 'node:test';
import assert from 'node:assert/strict';
import { publicAnalyticsPath, safePageview } from '../lib/analytics-privacy';
const context = { currentPath: '/events', marker: 'internal-marker', key: 'public-project-key', anonymousId: 'random-anonymous-id' };
test('analytics exact allowlist rejects secrets, queries and unknown routes', () => {
  for (const path of ['/g/secret', '/preferences', '/admin', '/settings', '/events/private-id', '/events?email=a@b.com', '/#token=secret', '/api/preferences', '//events', undefined]) assert.equal(publicAnalyticsPath(path), null);
  for (const path of ['/', '/events', '/about', '/privacy']) assert.equal(publicAnalyticsPath(path), path);
});
test('only explicit pageviews survive and all SDK properties are discarded', () => {
  const payload = { event: '$pageview', properties: { public_path: '/events', club_pageview: 'internal-marker', $current_url: 'https://example.com/g/secret', $referrer: 'secret', email: 'secret@example.com', $set: { name: 'secret' }, distinct_id: 'auth-identity' } };
  const safe = safePageview(payload, context);
  assert.deepEqual(safe?.properties, { token: context.key, distinct_id: context.anonymousId, $pathname: '/events', $process_person_profile: false, $geoip_disable: true });
  assert.equal(JSON.stringify(safe).includes('secret'), false);
  for (const event of ['$autocapture', '$identify', '$exception', '$pageleave', '$snapshot']) assert.equal(safePageview({ ...payload, event }, context), null);
  assert.equal(safePageview({ ...payload, properties: { public_path: '/events' } }, context), null);
  assert.equal(safePageview(payload, { ...context, currentPath: '/g/secret' }), null);
});
