// Lightweight pure-JS YAML <-> JSON converter for standard mappings, sequences, and scalars.

function parseScalar(raw) {
  const s = raw.trim();
  if (s === '' || s === 'null' || s === '~') return null;
  if (s === 'true') return true;
  if (s === 'false') return false;
  if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1);
  }
  if (s.startsWith('[') && s.endsWith(']')) {
    const inner = s.slice(1, -1).trim();
    if (!inner) return [];
    return inner.split(',').map((item) => parseScalar(item));
  }
  return s;
}

export function parseSimpleYaml(text) {
  const rawLines = text.split(/\r?\n/);
  const lines = [];
  for (const line of rawLines) {
    const stripped = line.replace(/\s+#.*$/, '');
    if (!stripped.trim() || stripped.trim().startsWith('#')) continue;
    const indent = line.search(/\S/);
    lines.push({ indent, text: stripped.trim() });
  }
  if (lines.length === 0) return {};

  let idx = 0;

  function parseBlock(minIndent) {
    const first = lines[idx];
    if (!first) return null;

    if (first.text.startsWith('- ') || first.text === '-') {
      const arr = [];
      while (idx < lines.length && lines[idx].indent === first.indent && (lines[idx].text.startsWith('- ') || lines[idx].text === '-')) {
        const current = lines[idx];
        const rest = current.text.slice(1).trim();
        idx += 1;
        if (!rest) {
          if (idx < lines.length && lines[idx].indent > current.indent) {
            arr.push(parseBlock(lines[idx].indent));
          } else {
            arr.push(null);
          }
        } else if (rest.includes(': ') || rest.endsWith(':')) {
          // Inline object start inside sequence item
          const colonPos = rest.indexOf(':');
          const k = rest.slice(0, colonPos).trim();
          const v = rest.slice(colonPos + 1).trim();
          const obj = {};
          if (v) {
            obj[k] = parseScalar(v);
          } else if (idx < lines.length && lines[idx].indent > current.indent) {
            obj[k] = parseBlock(lines[idx].indent);
          } else {
            obj[k] = null;
          }
          if (idx < lines.length && lines[idx].indent > current.indent) {
            const sub = parseBlock(lines[idx].indent);
            if (sub && typeof sub === 'object' && !Array.isArray(sub)) {
              Object.assign(obj, sub);
            }
          }
          arr.push(obj);
        } else {
          arr.push(parseScalar(rest));
        }
      }
      return arr;
    }

    const obj = {};
    while (idx < lines.length && lines[idx].indent >= minIndent) {
      const current = lines[idx];
      if (current.indent > minIndent) break;
      if (current.text.startsWith('- ')) break;
      const colonPos = current.text.indexOf(':');
      if (colonPos === -1) {
        throw new Error(`Invalid YAML syntax near: "${current.text}"`);
      }
      const key = current.text.slice(0, colonPos).trim().replace(/^["']|["']$/g, '');
      const val = current.text.slice(colonPos + 1).trim();
      idx += 1;
      if (val !== '') {
        obj[key] = parseScalar(val);
      } else if (idx < lines.length && lines[idx].indent > current.indent) {
        obj[key] = parseBlock(lines[idx].indent);
      } else {
        obj[key] = null;
      }
    }
    return obj;
  }

  return parseBlock(lines[0].indent);
}

export function stringifySimpleYaml(value, indentLevel = 0) {
  const pad = '  '.repeat(indentLevel);
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'boolean' || typeof value === 'number') return String(value);
  if (typeof value === 'string') {
    if (
      value === '' ||
      /[:#\-\[\]{}&*!|>'"%@`]/.test(value) ||
      /^\s|\s$/.test(value) ||
      /^(true|false|null|\d+(\.\d+)?)$/i.test(value)
    ) {
      return JSON.stringify(value);
    }
    return value;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    return value
      .map((item) => {
        if (item !== null && typeof item === 'object') {
          const nested = stringifySimpleYaml(item, indentLevel + 1);
          const firstLineBreak = nested.indexOf('\n');
          if (Array.isArray(item) || firstLineBreak === -1) {
            return `${pad}- ${nested.trimStart()}`;
          }
          const lines = nested.split('\n');
          return `${pad}- ${lines[0].trimStart()}\n${lines.slice(1).join('\n')}`;
        }
        return `${pad}- ${stringifySimpleYaml(item, indentLevel + 1)}`;
      })
      .join('\n');
  }
  const entries = Object.entries(value);
  if (entries.length === 0) return '{}';
  return entries
    .map(([k, v]) => {
      const safeKey = /^[a-zA-Z0-9_-]+$/.test(k) ? k : JSON.stringify(k);
      if (v !== null && typeof v === 'object' && ((Array.isArray(v) && v.length > 0) || (!Array.isArray(v) && Object.keys(v).length > 0))) {
        return `${pad}${safeKey}:\n${stringifySimpleYaml(v, indentLevel + 1)}`;
      }
      return `${pad}${safeKey}: ${stringifySimpleYaml(v, indentLevel + 1)}`;
    })
    .join('\n');
}
