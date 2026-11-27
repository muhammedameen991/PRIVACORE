// Pure Vanilla JS line-by-line LCS diff & structural JSON diff.

export function diffLines(textA, textB) {
  const a = textA.split(/\r?\n/);
  const b = textB.split(/\r?\n/);
  const m = a.length;
  const n = b.length;

  // Guard against huge inputs locking low-end browsers
  if (m * n > 250000) {
    const maxLen = Math.max(m, n);
    const out = [];
    for (let i = 0; i < maxLen; i += 1) {
      if (a[i] === b[i]) {
        out.push({ type: 'same', line: a[i] ?? '' });
      } else {
        if (i < m) out.push({ type: 'del', line: a[i] });
        if (i < n) out.push({ type: 'add', line: b[i] });
      }
    }
    return out;
  }

  const dp = Array.from({ length: m + 1 }, () => new Uint16Array(n + 1));
  for (let i = m - 1; i >= 0; i -= 1) {
    for (let j = n - 1; j >= 0; j -= 1) {
      if (a[i] === b[j]) {
        dp[i][j] = dp[i + 1][j + 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
  }

  const result = [];
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (a[i] === b[j]) {
      result.push({ type: 'same', line: a[i] });
      i += 1;
      j += 1;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      result.push({ type: 'del', line: a[i] });
      i += 1;
    } else {
      result.push({ type: 'add', line: b[j] });
      j += 1;
    }
  }
  while (i < m) {
    result.push({ type: 'del', line: a[i] });
    i += 1;
  }
  while (j < n) {
    result.push({ type: 'add', line: b[j] });
    j += 1;
  }
  return result;
}

export function diffJsonObjects(objA, objB, prefix = '$') {
  const diffs = [];

  if (objA === objB) return diffs;
  if (typeof objA !== typeof objB || objA === null || objB === null || Array.isArray(objA) !== Array.isArray(objB)) {
    diffs.push({ path: prefix, kind: 'changed', before: objA, after: objB });
    return diffs;
  }

  if (Array.isArray(objA)) {
    const maxLen = Math.max(objA.length, objB.length);
    for (let i = 0; i < maxLen; i += 1) {
      const itemPath = `${prefix}[${i}]`;
      if (i >= objA.length) {
        diffs.push({ path: itemPath, kind: 'added', before: undefined, after: objB[i] });
      } else if (i >= objB.length) {
        diffs.push({ path: itemPath, kind: 'removed', before: objA[i], after: undefined });
      } else {
        diffs.push(...diffJsonObjects(objA[i], objB[i], itemPath));
      }
    }
    return diffs;
  }

  if (typeof objA === 'object') {
    const keys = new Set([...Object.keys(objA), ...Object.keys(objB)]);
    for (const k of Array.from(keys).sort()) {
      const childPath = `${prefix}.${k}`;
      if (!(k in objA)) {
        diffs.push({ path: childPath, kind: 'added', before: undefined, after: objB[k] });
      } else if (!(k in objB)) {
        diffs.push({ path: childPath, kind: 'removed', before: objA[k], after: undefined });
      } else {
        diffs.push(...diffJsonObjects(objA[k], objB[k], childPath));
      }
    }
    return diffs;
  }

  if (objA !== objB) {
    diffs.push({ path: prefix, kind: 'changed', before: objA, after: objB });
  }
  return diffs;
}
