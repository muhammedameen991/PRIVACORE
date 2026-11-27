// Pure Vanilla JS ISO/IEC 18004 QR Code Generator (Byte mode UTF-8, Versions 1-14, EC L/M/Q/H)
// Zero external dependencies, works completely offline in the browser.

const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i += 1) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i += 1) {
    GF_EXP[i] = GF_EXP[i - 255];
  }
})();

function gfMul(a, b) {
  if (a === 0 || b === 0) return 0;
  return GF_EXP[GF_LOG[a] + GF_LOG[b]];
}

function rsGeneratorPoly(degree) {
  let poly = new Uint8Array([1]);
  for (let i = 0; i < degree; i += 1) {
    const next = new Uint8Array(poly.length + 1);
    const factor = GF_EXP[i];
    for (let j = 0; j < poly.length; j += 1) {
      next[j] ^= poly[j];
      next[j + 1] ^= gfMul(poly[j], factor);
    }
    poly = next;
  }
  return poly;
}

function rsComputeEc(data, ecCount) {
  const gen = rsGeneratorPoly(ecCount);
  const res = new Uint8Array(data.length + ecCount);
  res.set(data);
  for (let i = 0; i < data.length; i += 1) {
    const coef = res[i];
    if (coef !== 0) {
      for (let j = 0; j < gen.length; j += 1) {
        res[i + j] ^= gfMul(gen[j], coef);
      }
    }
  }
  return res.slice(data.length);
}

// Version tables for Versions 1..14
// Each entry: [totalCodewords, { L: [ecPerBlock, g1Blocks, g1Data, g2Blocks, g2Data], M: ..., Q: ..., H: ... }]
const VERSION_TABLE = {
  1:  [26,  { L: [7,1,19,0,0],   M: [10,1,16,0,0],  Q: [13,1,13,0,0],  H: [17,1,9,0,0] }],
  2:  [44,  { L: [10,1,34,0,0],  M: [16,1,28,0,0],  Q: [22,1,22,0,0],  H: [28,1,16,0,0] }],
  3:  [70,  { L: [15,1,55,0,0],  M: [26,1,44,0,0],  Q: [18,2,17,0,0],  H: [22,2,13,0,0] }],
  4:  [100, { L: [20,1,80,0,0],  M: [18,2,32,0,0],  Q: [26,2,24,0,0],  H: [16,4,9,0,0] }],
  5:  [134, { L: [26,1,108,0,0], M: [24,2,43,0,0],  Q: [18,2,15,2,16], H: [22,2,11,2,12] }],
  6:  [172, { L: [18,2,68,0,0],  M: [16,4,27,0,0],  Q: [24,4,19,0,0],  H: [28,4,15,0,0] }],
  7:  [196, { L: [20,2,78,0,0],  M: [18,4,31,0,0],  Q: [18,2,14,4,15], H: [26,4,13,1,14] }],
  8:  [242, { L: [24,2,97,0,0],  M: [22,2,38,2,39], Q: [22,4,18,2,19], H: [26,4,14,2,15] }],
  9:  [292, { L: [30,2,116,0,0], M: [22,3,36,2,37], Q: [20,4,16,4,17], H: [24,4,12,4,13] }],
  10: [346, { L: [18,2,68,2,69], M: [26,4,43,1,44], Q: [24,6,19,2,20], H: [28,6,15,2,16] }],
  11: [404, { L: [20,4,81,0,0],  M: [30,1,50,4,51], Q: [28,4,22,4,23], H: [24,3,12,8,13] }],
  12: [466, { L: [24,2,92,2,93], M: [22,6,36,2,37], Q: [26,4,20,6,21], H: [28,7,14,4,15] }],
  13: [532, { L: [26,4,107,0,0], M: [22,8,37,1,38], Q: [24,8,20,4,21], H: [22,12,11,4,12] }],
  14: [581, { L: [30,3,115,1,116], M: [24,4,40,5,41], Q: [20,11,16,5,17], H: [24,11,12,5,13] }]
};

const ALIGNMENT_POSITIONS = {
  1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30], 6: [6, 34],
  7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50],
  11: [6, 30, 54], 12: [6, 32, 58], 13: [6, 34, 62], 14: [6, 26, 46, 66]
};

const EC_FORMAT_BITS = { L: 1, M: 0, Q: 3, H: 2 };

function selectVersion(byteLen, ecLevel) {
  for (let v = 1; v <= 14; v += 1) {
    const [, blocks] = VERSION_TABLE[v];
    const [, g1c, g1d, g2c, g2d] = blocks[ecLevel];
    const capacityBytes = g1c * g1d + g2c * g2d;
    const countBits = v <= 9 ? 8 : 16;
    const totalBitsNeeded = 4 + countBits + byteLen * 8;
    if (totalBitsNeeded <= capacityBytes * 8) {
      return v;
    }
  }
  throw new Error('Input is too long for local QR encoding (max ~450 bytes depending on error correction).');
}

function buildCodewords(bytes, version, ecLevel) {
  const [, blocks] = VERSION_TABLE[version];
  const [ecPerBlock, g1c, g1d, g2c, g2d] = blocks[ecLevel];
  const dataCapacity = g1c * g1d + g2c * g2d;

  const bits = [];
  const pushBits = (val, len) => {
    for (let i = len - 1; i >= 0; i -= 1) {
      bits.push((val >>> i) & 1);
    }
  };

  pushBits(0b0100, 4); // Byte mode
  pushBits(bytes.length, version <= 9 ? 8 : 16);
  for (const b of bytes) pushBits(b, 8);

  const maxBits = dataCapacity * 8;
  const terminatorLen = Math.min(4, maxBits - bits.length);
  pushBits(0, terminatorLen);
  while (bits.length % 8 !== 0) bits.push(0);

  const dataBytes = [];
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0;
    for (let b = 0; b < 8; b += 1) byte = (byte << 1) | bits[i + b];
    dataBytes.push(byte);
  }
  const padBytes = [0xec, 0x11];
  let padIdx = 0;
  while (dataBytes.length < dataCapacity) {
    dataBytes.push(padBytes[padIdx % 2]);
    padIdx += 1;
  }

  const dataBlocks = [];
  const ecBlocks = [];
  let offset = 0;
  for (let i = 0; i < g1c; i += 1) {
    const slice = new Uint8Array(dataBytes.slice(offset, offset + g1d));
    dataBlocks.push(slice);
    ecBlocks.push(rsComputeEc(slice, ecPerBlock));
    offset += g1d;
  }
  for (let i = 0; i < g2c; i += 1) {
    const slice = new Uint8Array(dataBytes.slice(offset, offset + g2d));
    dataBlocks.push(slice);
    ecBlocks.push(rsComputeEc(slice, ecPerBlock));
    offset += g2d;
  }

  const out = [];
  const maxDataLen = Math.max(g1d, g2d);
  for (let i = 0; i < maxDataLen; i += 1) {
    for (const blk of dataBlocks) {
      if (i < blk.length) out.push(blk[i]);
    }
  }
  for (let i = 0; i < ecPerBlock; i += 1) {
    for (const blk of ecBlocks) {
      if (i < blk.length) out.push(blk[i]);
    }
  }
  return out;
}

function createMatrix(version) {
  const size = version * 4 + 17;
  const grid = Array.from({ length: size }, () => new Int8Array(size).fill(-1));
  const reserved = Array.from({ length: size }, () => new Uint8Array(size));

  const setModule = (r, c, val, lock = true) => {
    if (r < 0 || c < 0 || r >= size || c >= size) return;
    grid[r][c] = val ? 1 : 0;
    if (lock) reserved[r][c] = 1;
  };

  const placeFinder = (top, left) => {
    for (let r = -1; r <= 7; r += 1) {
      for (let c = -1; c <= 7; c += 1) {
        const rr = top + r;
        const cc = left + c;
        if (rr < 0 || cc < 0 || rr >= size || cc >= size) continue;
        const inOuter = r >= 0 && r <= 6 && c >= 0 && c <= 6;
        const isDark =
          inOuter &&
          (r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4));
        setModule(rr, cc, isDark ? 1 : 0, true);
      }
    }
  };

  placeFinder(0, 0);
  placeFinder(0, size - 7);
  placeFinder(size - 7, 0);

  for (let i = 8; i < size - 8; i += 1) {
    setModule(6, i, i % 2 === 0 ? 1 : 0, true);
    setModule(i, 6, i % 2 === 0 ? 1 : 0, true);
  }

  const align = ALIGNMENT_POSITIONS[version];
  for (const r of align) {
    for (const c of align) {
      if (reserved[r][c]) continue;
      for (let dr = -2; dr <= 2; dr += 1) {
        for (let dc = -2; dc <= 2; dc += 1) {
          const isDark = Math.max(Math.abs(dr), Math.abs(dc)) !== 1;
          setModule(r + dr, c + dc, isDark ? 1 : 0, true);
        }
      }
    }
  }

  // Reserve format info + dark module
  setModule(size - 8, 8, 1, true);
  for (let i = 0; i < 9; i += 1) {
    if (i !== 6) {
      reserved[8][i] = 1;
      reserved[i][8] = 1;
    }
  }
  for (let i = 0; i < 8; i += 1) {
    reserved[8][size - 1 - i] = 1;
    reserved[size - 1 - i][8] = 1;
  }

  if (version >= 7) {
    for (let i = 0; i < 6; i += 1) {
      for (let j = 0; j < 3; j += 1) {
        reserved[i][size - 11 + j] = 1;
        reserved[size - 11 + j][i] = 1;
      }
    }
  }

  return { size, grid, reserved };
}

function bchFormatInfo(ecLevel, maskId) {
  const data = (EC_FORMAT_BITS[ecLevel] << 3) | maskId;
  let rem = data << 10;
  const poly = 0x537;
  for (let i = 4; i >= 0; i -= 1) {
    if ((rem >>> (i + 10)) & 1) {
      rem ^= poly << i;
    }
  }
  return ((data << 10) | rem) ^ 0x5412;
}

function bchVersionInfo(version) {
  let rem = version << 12;
  const poly = 0x1f25;
  for (let i = 5; i >= 0; i -= 1) {
    if ((rem >>> (i + 12)) & 1) {
      rem ^= poly << i;
    }
  }
  return (version << 12) | rem;
}

function applyFormatAndVersion(grid, size, version, ecLevel, maskId) {
  const fmt = bchFormatInfo(ecLevel, maskId);
  for (let i = 0; i < 15; i += 1) {
    const bit = (fmt >>> i) & 1;
    if (i < 6) grid[i][8] = bit;
    else if (i < 8) grid[i + 1][8] = bit;
    else grid[size - 15 + i][8] = bit;

    if (i < 8) grid[8][size - 1 - i] = bit;
    else if (i < 9) grid[8][7] = bit;
    else grid[8][14 - i] = bit;
  }

  if (version >= 7) {
    const verBits = bchVersionInfo(version);
    for (let i = 0; i < 18; i += 1) {
      const bit = (verBits >>> i) & 1;
      const r = Math.floor(i / 3);
      const c = size - 11 + (i % 3);
      grid[r][c] = bit;
      grid[c][r] = bit;
    }
  }
}

function maskCondition(maskId, r, c) {
  switch (maskId) {
    case 0: return (r + c) % 2 === 0;
    case 1: return r % 2 === 0;
    case 2: return c % 3 === 0;
    case 3: return (r + c) % 3 === 0;
    case 4: return (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0;
    case 5: return ((r * c) % 2) + ((r * c) % 3) === 0;
    case 6: return (((r * c) % 2) + ((r * c) % 3)) % 2 === 0;
    case 7: return (((r + c) % 2) + ((r * c) % 3)) % 2 === 0;
    default: return false;
  }
}

function penaltyScore(grid, size) {
  let score = 0;
  for (let r = 0; r < size; r += 1) {
    let runColor = grid[r][0];
    let runLen = 1;
    for (let c = 1; c < size; c += 1) {
      if (grid[r][c] === runColor) {
        runLen += 1;
      } else {
        if (runLen >= 5) score += 3 + (runLen - 5);
        runColor = grid[r][c];
        runLen = 1;
      }
    }
    if (runLen >= 5) score += 3 + (runLen - 5);
  }
  for (let c = 0; c < size; c += 1) {
    let runColor = grid[0][c];
    let runLen = 1;
    for (let r = 1; r < size; r += 1) {
      if (grid[r][c] === runColor) {
        runLen += 1;
      } else {
        if (runLen >= 5) score += 3 + (runLen - 5);
        runColor = grid[r][c];
        runLen = 1;
      }
    }
    if (runLen >= 5) score += 3 + (runLen - 5);
  }
  for (let r = 0; r < size - 1; r += 1) {
    for (let c = 0; c < size - 1; c += 1) {
      const v = grid[r][c];
      if (v === grid[r][c + 1] && v === grid[r + 1][c] && v === grid[r + 1][c + 1]) {
        score += 3;
      }
    }
  }
  return score;
}

export function generateQrMatrix(text, ecLevel = 'M') {
  const bytes = new TextEncoder().encode(text);
  const version = selectVersion(bytes.length, ecLevel);
  const codewords = buildCodewords(bytes, version, ecLevel);
  const { size, grid, reserved } = createMatrix(version);

  let bitIndex = 0;
  const totalBits = codewords.length * 8;
  let upward = true;
  for (let col = size - 1; col > 0; col -= 2) {
    if (col === 6) col -= 1;
    for (let i = 0; i < size; i += 1) {
      const r = upward ? size - 1 - i : i;
      for (let dx = 0; dx < 2; dx += 1) {
        const c = col - dx;
        if (!reserved[r][c]) {
          let bit = 0;
          if (bitIndex < totalBits) {
            bit = (codewords[bitIndex >>> 3] >>> (7 - (bitIndex & 7))) & 1;
            bitIndex += 1;
          }
          grid[r][c] = bit;
        }
      }
    }
    upward = !upward;
  }

  let bestMask = 0;
  let bestScore = Infinity;
  let bestGrid = null;

  for (let mask = 0; mask < 8; mask += 1) {
    const candidate = grid.map((row) => new Int8Array(row));
    for (let r = 0; r < size; r += 1) {
      for (let c = 0; c < size; c += 1) {
        if (!reserved[r][c] && maskCondition(mask, r, c)) {
          candidate[r][c] ^= 1;
        }
      }
    }
    applyFormatAndVersion(candidate, size, version, ecLevel, mask);
    const sc = penaltyScore(candidate, size);
    if (sc < bestScore) {
      bestScore = sc;
      bestMask = mask;
      bestGrid = candidate;
    }
  }

  return { version, ecLevel, mask: bestMask, size, modules: bestGrid };
}

export function qrToSvg(qr, fg = '#0e0f13', bg = '#ffffff', quietZone = 4) {
  const total = qr.size + quietZone * 2;
  const rects = [];
  for (let r = 0; r < qr.size; r += 1) {
    for (let c = 0; c < qr.size; c += 1) {
      if (qr.modules[r][c] === 1) {
        rects.push(`<rect x="${c + quietZone}" y="${r + quietZone}" width="1" height="1"/>`);
      }
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" width="240" height="240" shape-rendering="crispEdges"><rect width="${total}" height="${total}" fill="${bg}"/><g fill="${fg}">${rects.join('')}</g></svg>`;
}

export function qrToPngDataUrl(qr, scale = 8, fg = '#0e0f13', bg = '#ffffff', quietZone = 4) {
  const total = qr.size + quietZone * 2;
  const canvas = document.createElement('canvas');
  canvas.width = total * scale;
  canvas.height = total * scale;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = fg;
  for (let r = 0; r < qr.size; r += 1) {
    for (let c = 0; c < qr.size; c += 1) {
      if (qr.modules[r][c] === 1) {
        ctx.fillRect((c + quietZone) * scale, (r + quietZone) * scale, scale, scale);
      }
    }
  }
  return canvas.toDataURL('image/png');
}
