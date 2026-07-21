// Pure version logic for the Emby pin watcher. No I/O and no network here:
// everything in this module is a function of its arguments, which is what
// makes the classification testable without hitting the GitHub API.

const VERSION_RE = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/;

// How many of the oldest surviving releases count as the danger zone. Emby
// prunes the 4.10 pre-release line on a short rolling window, so a pin that
// has fallen this far down is one prune away from breaking CI.
const STALE_EDGE = 2;

export function parseVersion(str) {
  if (typeof str !== 'string') return null;
  const m = VERSION_RE.exec(str.trim());
  if (!m) return null;
  return m.slice(1).map(Number);
}

export function compareVersions(a, b) {
  const pa = parseVersion(a);
  const pb = parseVersion(b);
  if (!pa || !pb) throw new Error(`cannot compare versions: ${a}, ${b}`);
  for (let i = 0; i < 4; i += 1) {
    if (pa[i] !== pb[i]) return pa[i] - pb[i];
  }
  return 0;
}

export function lineOf(str) {
  const parts = parseVersion(str);
  if (!parts) throw new Error(`malformed version: ${str}`);
  return parts.slice(0, 3).join('.');
}

export function classify({ pinned, available }) {
  const line = lineOf(pinned); // throws on a malformed pin, deliberately

  const inLine = available
    .filter((v) => parseVersion(v) !== null && lineOf(v) === line)
    .sort(compareVersions);

  const newest = inLine.length > 0 ? inLine[inLine.length - 1] : null;
  const index = inLine.indexOf(pinned);

  if (index === -1) {
    return {
      status: 'urgent',
      target: newest,
      reason: newest
        ? `Pinned ${pinned} no longer exists upstream. CI is broken until the pin moves to ${newest}.`
        : `Pinned ${pinned} no longer exists upstream and no release remains in the ${line} line.`,
    };
  }

  if (index < STALE_EDGE) {
    return {
      status: 'stale',
      target: newest,
      reason: `Pinned ${pinned} is among the oldest ${STALE_EDGE} surviving ${line} releases and is likely to be pruned next.`,
    };
  }

  if (newest !== pinned) {
    return {
      status: 'routine',
      target: newest,
      reason: `A newer ${line} release is available: ${newest}.`,
    };
  }

  return {
    status: 'ok',
    target: null,
    reason: `Pinned ${pinned} is the newest surviving ${line} release.`,
  };
}
