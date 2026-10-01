// Minimal YAML parser for this dataset's deliberately narrow subset.
//
// Why not js-yaml: the repo is zero-dependency by design, and the data files use
// only mappings, sequences, scalars, inline flow maps, and `>`/`|` block scalars.
// That is a few hundred lines to support directly, versus an npm install that the
// site itself never needs. If the dataset ever needs anchors, tags, or multi-document
// files, replace this with js-yaml rather than growing it.
//
// Supported:
//   key: value              scalars (string, number, bool, null, ISO date)
//   key:                    nested maps and sequences
//   - item                  sequences of scalars or maps
//   key: { a: 1, b: 2 }     inline flow maps (one level, scalar values)
//   key: [a, b, c]          inline flow sequences (scalar items)
//   key: >                  folded block scalars
//   key: |                  literal block scalars
//   # comment               full-line and trailing (outside quotes)

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function stripComment(line) {
  let inSingle = false;
  let inDouble = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === "'" && !inDouble) inSingle = !inSingle;
    else if (c === '"' && !inSingle) inDouble = !inDouble;
    else if (c === '#' && !inSingle && !inDouble) {
      // Only a comment if preceded by whitespace or at line start.
      if (i === 0 || /\s/.test(line[i - 1])) return line.slice(0, i);
    }
  }
  return line;
}

function parseScalar(raw) {
  const s = raw.trim();
  if (s === '') return null;
  if (s === 'null' || s === '~') return null;
  if (s === 'true') return true;
  if (s === 'false') return false;
  if ((s.startsWith('"') && s.endsWith('"') && s.length > 1) ||
      (s.startsWith("'") && s.endsWith("'") && s.length > 1)) {
    return s.slice(1, -1);
  }
  // Dates stay strings — Date objects would serialise with timezone surprises.
  if (DATE_RE.test(s)) return s;
  if (/^-?\d+$/.test(s)) return parseInt(s, 10);
  if (/^-?\d*\.\d+$/.test(s)) return parseFloat(s);
  return s;
}

function parseFlowSeq(raw) {
  // [a, b, c] — scalar items only, no nesting.
  const inner = raw.trim().slice(1, -1).trim();
  if (inner === '') return [];
  return inner.split(',').map(parseScalar);
}

function parseFlowMap(raw) {
  // { a: 1, b: 2 } — scalar values only, no nesting.
  const inner = raw.trim().slice(1, -1).trim();
  const out = {};
  if (inner === '') return out;
  for (const pair of inner.split(',')) {
    const idx = pair.indexOf(':');
    if (idx === -1) continue;
    out[pair.slice(0, idx).trim()] = parseScalar(pair.slice(idx + 1));
  }
  return out;
}

/** Tokenise into {indent, content, line}, dropping blanks and comment-only lines. */
function tokenise(text) {
  const rows = [];
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmedFull = rawLine.trim();
    if (trimmedFull === '' || trimmedFull.startsWith('#')) continue;
    const content = stripComment(rawLine).trimEnd();
    if (content.trim() === '') continue;
    rows.push({
      indent: content.length - content.trimStart().length,
      content: content.trim(),
      line: i + 1,
      raw: rawLine,
    });
  }
  return { rows, lines };
}

/**
 * Collect a block scalar's text. Block scalars are the one place where blank
 * lines and `#` are literal content, so they read from the raw source lines
 * rather than the filtered token stream.
 */
function readBlockScalar(lines, startLine, parentIndent, style) {
  const collected = [];
  let i = startLine; // 0-based index of the line after the `key: >` line
  let blockIndent = null;
  for (; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === '') { collected.push(''); continue; }
    const indent = line.length - line.trimStart().length;
    if (indent <= parentIndent) break;
    if (blockIndent === null) blockIndent = indent;
    collected.push(line.slice(blockIndent));
  }
  while (collected.length && collected[collected.length - 1] === '') collected.pop();

  if (style === '|') return collected.join('\n') + '\n';
  // Folded: blank lines become paragraph breaks, others join with spaces.
  const paragraphs = [];
  let current = [];
  for (const l of collected) {
    if (l === '') { if (current.length) { paragraphs.push(current.join(' ')); current = []; } }
    else current.push(l.trim());
  }
  if (current.length) paragraphs.push(current.join(' '));
  return paragraphs.join('\n\n') + '\n';
}

export function parseYaml(text) {
  const { rows, lines } = tokenise(text);
  let pos = 0;

  // Block scalars are consumed from raw lines, so the token cursor must skip
  // past any tokens that fell inside them.
  function skipTokensThrough(rawLineIdx) {
    while (pos < rows.length && rows[pos].line <= rawLineIdx) pos++;
  }

  function parseBlock(indent) {
    // Decide list vs map from the first row at this indent.
    if (pos >= rows.length) return null;
    return rows[pos].content.startsWith('- ') || rows[pos].content === '-'
      ? parseList(indent)
      : parseMap(indent);
  }

  function parseList(indent) {
    const out = [];
    while (pos < rows.length && rows[pos].indent === indent && (rows[pos].content.startsWith('- ') || rows[pos].content === '-')) {
      const row = rows[pos];
      const after = row.content === '-' ? '' : row.content.slice(2).trim();
      pos++;

      if (after === '') {
        out.push(pos < rows.length && rows[pos].indent > indent ? parseBlock(rows[pos].indent) : null);
        continue;
      }

      // `- key: value` starts a map whose first key sits at indent + 2.
      const colonIdx = findKeyColon(after);
      if (colonIdx !== -1) {
        const item = {};
        consumeKeyValue(after, colonIdx, item, indent + 2, row);
        while (pos < rows.length && rows[pos].indent === indent + 2) {
          const r = rows[pos];
          const ci = findKeyColon(r.content);
          if (ci === -1) break;
          pos++;
          consumeKeyValue(r.content, ci, item, indent + 2, r);
        }
        out.push(item);
      } else {
        out.push(parseScalar(after));
      }
    }
    return out;
  }

  function parseMap(indent) {
    const out = {};
    while (pos < rows.length && rows[pos].indent === indent) {
      const row = rows[pos];
      const colonIdx = findKeyColon(row.content);
      if (colonIdx === -1) break;
      pos++;
      consumeKeyValue(row.content, colonIdx, out, indent, row);
    }
    return out;
  }

  function consumeKeyValue(content, colonIdx, target, indent, row) {
    const key = content.slice(0, colonIdx).trim();
    const rest = content.slice(colonIdx + 1).trim();

    if (rest === '>' || rest === '|' || rest === '>-' || rest === '|-') {
      const style = rest[0];
      let value = readBlockScalar(lines, row.line, indent, style);
      if (rest.endsWith('-')) value = value.replace(/\n+$/, '');
      // Advance past every token consumed by the block.
      let last = row.line;
      for (let i = row.line; i < lines.length; i++) {
        if (lines[i].trim() === '') continue;
        const ind = lines[i].length - lines[i].trimStart().length;
        if (ind <= indent) break;
        last = i + 1;
      }
      skipTokensThrough(last);
      target[key] = value;
      return;
    }

    if (rest.startsWith('{')) { target[key] = parseFlowMap(rest); return; }
    if (rest.startsWith('[')) { target[key] = parseFlowSeq(rest); return; }

    if (rest === '') {
      target[key] = pos < rows.length && rows[pos].indent > indent ? parseBlock(rows[pos].indent) : null;
      return;
    }

    target[key] = parseScalar(rest);
  }

  /** Index of the `: ` separating key from value, ignoring colons inside quotes/URLs. */
  function findKeyColon(s) {
    let inSingle = false;
    let inDouble = false;
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (c === "'" && !inDouble) inSingle = !inSingle;
      else if (c === '"' && !inSingle) inDouble = !inDouble;
      else if (c === ':' && !inSingle && !inDouble) {
        if (i === s.length - 1 || s[i + 1] === ' ') return i;
      }
    }
    return -1;
  }

  return pos < rows.length || rows.length ? parseBlock(rows.length ? rows[0].indent : 0) : {};
}
