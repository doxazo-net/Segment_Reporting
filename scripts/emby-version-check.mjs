#!/usr/bin/env node
// Reads the pinned Emby version, lists surviving releases in the same line,
// and reports a classification as GitHub Actions step outputs.
//
// A release counts as a valid target only if its tarball asset is actually
// present. A release that exists but is missing its asset is worse than one
// that is simply gone, because the fetch would fail at build time instead of
// being detectable here.

import { readFile, appendFile } from 'node:fs/promises';
import { classify, lineOf, parseVersion } from './emby-version.mjs';

const REPO = 'MediaBrowser/Emby.Releases';
const VERSION_FILE = '.emby-version';

function assetNameFor(version) {
  return `emby-server-freebsd14_${version}_amd64.tar.xz`;
}

async function listReleases(token) {
  const headers = {
    accept: 'application/vnd.github+json',
    'user-agent': 'segrep-emby-bump',
  };
  if (token) headers.authorization = `Bearer ${token}`;

  const out = [];
  for (let page = 1; page <= 5; page += 1) {
    const url = `https://api.github.com/repos/${REPO}/releases?per_page=100&page=${page}`;
    const res = await fetch(url, { headers });
    if (!res.ok) {
      throw new Error(`GitHub API returned ${res.status} for ${url}`);
    }
    const batch = await res.json();
    out.push(...batch);
    if (batch.length < 100) break;
  }
  return out;
}

async function main() {
  const pinned = (await readFile(VERSION_FILE, 'utf8')).trim();
  if (!parseVersion(pinned)) {
    throw new Error(`${VERSION_FILE} does not contain a four-part version: "${pinned}"`);
  }

  const releases = await listReleases(process.env.GH_TOKEN);

  // Keep only releases whose expected asset is genuinely downloadable.
  const available = releases
    .filter((r) => !r.draft)
    .filter((r) => (r.assets || []).some((a) => a.name === assetNameFor(r.tag_name)))
    .map((r) => r.tag_name);

  const result = classify({ pinned, available });

  const inLineCount = available.filter(
    (v) => parseVersion(v) !== null && lineOf(v) === lineOf(pinned),
  ).length;

  console.log(`pinned:    ${pinned}`);
  console.log(`in-line:   ${inLineCount} surviving release(s)`);
  console.log(`status:    ${result.status}`);
  console.log(`target:    ${result.target ?? '(none)'}`);
  console.log(`reason:    ${result.reason}`);

  const outFile = process.env.GITHUB_OUTPUT;
  if (outFile) {
    await appendFile(
      outFile,
      [
        `status=${result.status}`,
        `target=${result.target ?? ''}`,
        `pinned=${pinned}`,
        `reason=${result.reason}`,
        '',
      ].join('\n'),
    );
  }
}

main().catch((err) => {
  // Fail loudly. A silent skip here would look identical to a healthy pin.
  console.error(`emby-version-check failed: ${err.message}`);
  process.exit(1);
});
