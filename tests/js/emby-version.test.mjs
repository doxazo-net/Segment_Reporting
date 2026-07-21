import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseVersion,
  compareVersions,
  lineOf,
  classify,
} from '../../scripts/emby-version.mjs';

test('parseVersion accepts a four-part version', () => {
  assert.deepEqual(parseVersion('4.10.0.19'), [4, 10, 0, 19]);
});

test('parseVersion rejects malformed input', () => {
  assert.equal(parseVersion('4.10.0'), null);
  assert.equal(parseVersion('4.10.0.x'), null);
  assert.equal(parseVersion(''), null);
  assert.equal(parseVersion('v4.10.0.19'), null);
});

test('compareVersions is numeric, not lexicographic', () => {
  // The regression this guards: string sort puts .20 before .9
  assert.ok(compareVersions('4.10.0.20', '4.10.0.9') > 0);
  assert.ok(compareVersions('4.10.0.9', '4.10.0.20') < 0);
  assert.equal(compareVersions('4.10.0.19', '4.10.0.19'), 0);
});

test('lineOf returns the first three parts', () => {
  assert.equal(lineOf('4.10.0.19'), '4.10.0');
  assert.equal(lineOf('4.9.1.90'), '4.9.1');
});

test('classify returns urgent when the pinned release is gone', () => {
  const r = classify({
    pinned: '4.10.0.13',
    available: ['4.10.0.17', '4.10.0.19', '4.10.0.20'],
  });
  assert.equal(r.status, 'urgent');
  assert.equal(r.target, '4.10.0.20');
});

test('classify returns stale when pinned is in the oldest two survivors', () => {
  const r = classify({
    pinned: '4.10.0.19',
    available: ['4.10.0.17', '4.10.0.19', '4.10.0.20'],
  });
  assert.equal(r.status, 'stale');
  assert.equal(r.target, '4.10.0.20');
});

test('classify never targets the pinned version in a small window', () => {
  // Regression: with <= STALE_EDGE survivors and the pin already newest, the
  // stale branch used to return target === pinned. The watcher would then
  // commit an unchanged file and fail the scheduled run.
  const r = classify({ pinned: '4.10.0.20', available: ['4.10.0.19', '4.10.0.20'] });
  assert.notEqual(r.target, '4.10.0.20');
  assert.equal(r.status, 'ok');
  assert.equal(r.target, null);
});

test('classify handles a single surviving release that is the pin', () => {
  const r = classify({ pinned: '4.10.0.19', available: ['4.10.0.19'] });
  assert.equal(r.status, 'ok');
  assert.equal(r.target, null);
});

test('classify still reports stale when a newer release exists in a small window', () => {
  // The guard must not suppress a genuine stale signal.
  const r = classify({ pinned: '4.10.0.19', available: ['4.10.0.19', '4.10.0.20'] });
  assert.equal(r.status, 'stale');
  assert.equal(r.target, '4.10.0.20');
});

test('classify returns routine when a newer in-line release exists', () => {
  const r = classify({
    pinned: '4.10.0.19',
    available: ['4.10.0.17', '4.10.0.18', '4.10.0.19', '4.10.0.20'],
  });
  assert.equal(r.status, 'routine');
  assert.equal(r.target, '4.10.0.20');
});

test('classify returns ok when pinned is newest and not near the edge', () => {
  const r = classify({
    pinned: '4.10.0.20',
    available: ['4.10.0.17', '4.10.0.18', '4.10.0.19', '4.10.0.20'],
  });
  assert.equal(r.status, 'ok');
  assert.equal(r.target, null);
});

test('classify ignores releases from a different line', () => {
  const r = classify({
    pinned: '4.10.0.19',
    available: ['4.10.0.19', '4.10.0.20', '4.11.0.1', '4.11.0.2'],
  });
  // 4.11.x must never be proposed: crossing a line retargets the ABI
  assert.equal(r.target, '4.10.0.20');
});

test('classify treats an empty in-line list as urgent with no target', () => {
  const r = classify({ pinned: '4.10.0.19', available: ['4.11.0.1'] });
  assert.equal(r.status, 'urgent');
  assert.equal(r.target, null);
});

test('classify throws on a malformed pin rather than guessing', () => {
  assert.throws(() => classify({ pinned: 'nonsense', available: ['4.10.0.20'] }));
});
