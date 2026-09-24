import test from 'node:test';
import assert from 'node:assert/strict';
import { cacheMatchesProfile, isLinkedInLocked, isTrustedLinkedIn, parseLinkedInInput, profilePhoto, shouldPromoteRegistrationUrl, sniffImage } from '../lib/profile-rules';

test('typed LinkedIn must name a real /in/ profile', () => {
  assert.equal(parseLinkedInInput('https://www.linkedin.com/in/Jane-Doe/?x=1'), 'https://www.linkedin.com/in/jane-doe');
  assert.equal(parseLinkedInInput('linkedin.com/in/jane'), 'https://www.linkedin.com/in/jane');
  for (const bad of ['hello', 'jane-doe', 'https://linkedin.com/company/acme', 'https://evil.com/in/jane', '', null, 'x'.repeat(400)]) {
    assert.equal(parseLinkedInInput(bad), null, String(bad));
  }
});
test('one trust gate: missing confidence is not trusted', () => {
  assert.equal(isTrustedLinkedIn({ linkedinUrl: 'https://www.linkedin.com/in/a', linkedinConfidence: 'given' }), true);
  assert.equal(isTrustedLinkedIn({ linkedinUrl: 'https://www.linkedin.com/in/a', linkedinConfidence: 'high' }), true);
  assert.equal(isTrustedLinkedIn({ linkedinUrl: 'https://www.linkedin.com/in/a', linkedinConfidence: 'low' }), false);
  assert.equal(isTrustedLinkedIn({ linkedinUrl: 'https://www.linkedin.com/in/a' }), false);
});
test('a self or admin URL is never replaced by a registration answer', () => {
  const self = { linkedinUrl: 'https://www.linkedin.com/in/me', linkedinConfidence: 'given', linkedinSource: 'self' };
  assert.equal(isLinkedInLocked(self), true);
  assert.equal(shouldPromoteRegistrationUrl(self, 'https://www.linkedin.com/in/other'), false);
  assert.equal(shouldPromoteRegistrationUrl({ ...self, linkedinSource: 'admin' }, 'https://www.linkedin.com/in/other'), false);
  // A plain registration value is still refreshed by a newer registration answer.
  assert.equal(shouldPromoteRegistrationUrl({ ...self, linkedinSource: 'registration' }, 'https://www.linkedin.com/in/other'), true);
  assert.equal(shouldPromoteRegistrationUrl(undefined, 'https://www.linkedin.com/in/new'), true);
  assert.equal(shouldPromoteRegistrationUrl(self, null), false);
});
test('stale enrichment cache for another profile is ignored', () => {
  assert.equal(cacheMatchesProfile('https://www.linkedin.com/in/old', 'https://www.linkedin.com/in/new'), false);
  assert.equal(cacheMatchesProfile('https://linkedin.com/in/Same/', 'https://www.linkedin.com/in/same'), true);
  assert.equal(cacheMatchesProfile(undefined, 'https://www.linkedin.com/in/same'), false);
});
test('photo precedence: uploaded, then trusted LinkedIn, then Luma', () => {
  const base = { avatarUrl: 'https://images.lumacdn.com/a.jpg', linkedinPhoto: '/api/img/avatars/club-1/x.jpg', linkedinUrl: 'https://www.linkedin.com/in/a', linkedinConfidence: 'high' };
  assert.deepEqual(profilePhoto({ ...base, photoUrl: '/api/img/avatars/user-1/y.webp' }), { url: '/api/img/avatars/user-1/y.webp', source: 'uploaded' });
  assert.deepEqual(profilePhoto(base), { url: '/api/img/avatars/club-1/x.jpg', source: 'linkedin' });
  assert.deepEqual(profilePhoto({ ...base, linkedinConfidence: 'low' }), { url: 'https://images.lumacdn.com/a.jpg', source: 'luma' });
  assert.equal(profilePhoto({ avatarUrl: 'https://evil.example/a.jpg' }), undefined);
  assert.equal(profilePhoto({ photoUrl: '/api/img/avatars/../../secret' }), undefined);
});
test('image type comes from bytes, not the declared MIME', () => {
  assert.equal(sniffImage(new Uint8Array([0xff, 0xd8, 0xff, 0xe0])), 'jpeg');
  assert.equal(sniffImage(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), 'png');
  assert.equal(sniffImage(new TextEncoder().encode('RIFF\0\0\0\0WEBPVP8 ')), 'webp');
  assert.equal(sniffImage(new TextEncoder().encode('GIF89a')), null);
  assert.equal(sniffImage(new TextEncoder().encode('<svg onload=alert(1)>')), null);
});
