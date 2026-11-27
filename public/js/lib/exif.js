// Local binary file inspection: File magic signatures, PNG chunks, JPEG EXIF/GPS IFD parser, and Canvas metadata stripper.

const EXIF_TAGS = {
  0x010e: 'ImageDescription',
  0x010f: 'Make',
  0x0110: 'Model',
  0x0112: 'Orientation',
  0x011a: 'XResolution',
  0x011b: 'YResolution',
  0x0131: 'Software',
  0x0132: 'DateTime',
  0x013b: 'Artist',
  0x8298: 'Copyright',
  0x8769: 'ExifIFDPointer',
  0x8825: 'GPSInfoIFDPointer',
  0x9003: 'DateTimeOriginal',
  0x9004: 'DateTimeDigitized',
  0xa002: 'PixelXDimension',
  0xa003: 'PixelYDimension',
  0xa430: 'CameraOwnerName',
  0xa431: 'BodySerialNumber',
  0xa434: 'LensModel'
};

export function detectMagicSignature(bytes) {
  const hex = Array.from(bytes.slice(0, 16))
    .map((b) => b.toString(16).padStart(2, '0').toUpperCase())
    .join(' ');

  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { type: 'JPEG Image', mime: 'image/jpeg', hex };
  }
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return { type: 'PNG Image', mime: 'image/png', hex };
  }
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) {
    return { type: 'GIF Image', mime: 'image/gif', hex };
  }
  if (
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) {
    return { type: 'WebP Image', mime: 'image/webp', hex };
  }
  if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) {
    return { type: 'PDF Document', mime: 'application/pdf', hex };
  }
  if (bytes[0] === 0x50 && bytes[1] === 0x4b && (bytes[2] === 0x03 || bytes[2] === 0x05)) {
    return { type: 'ZIP / Office / JAR Archive', mime: 'application/zip', hex };
  }
  if (bytes[0] === 0x4d && bytes[1] === 0x5a) {
    return { type: 'Windows PE Executable (MZ)', mime: 'application/x-msdownload', hex };
  }
  if (bytes[0] === 0x7f && bytes[1] === 0x45 && bytes[2] === 0x4c && bytes[3] === 0x46) {
    return { type: 'Linux ELF Executable', mime: 'application/x-elf', hex };
  }
  return { type: 'Unknown / Text / Other', mime: 'application/octet-stream', hex };
}

function readAscii(view, offset, length) {
  let out = '';
  for (let i = 0; i < length && offset + i < view.byteLength; i += 1) {
    const code = view.getUint8(offset + i);
    if (code === 0) break;
    if (code >= 32 && code <= 126) out += String.fromCharCode(code);
  }
  return out.trim();
}

function parseIfd(view, tiffStart, ifdOffset, littleEndian) {
  const fields = {};
  if (tiffStart + ifdOffset + 2 > view.byteLength) return fields;
  const count = view.getUint16(tiffStart + ifdOffset, littleEndian);
  const typeSizes = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8 };

  for (let i = 0; i < count; i += 1) {
    const entryOffset = tiffStart + ifdOffset + 2 + i * 12;
    if (entryOffset + 12 > view.byteLength) break;
    const tag = view.getUint16(entryOffset, littleEndian);
    const type = view.getUint16(entryOffset + 2, littleEndian);
    const numValues = view.getUint32(entryOffset + 4, littleEndian);
    const valueSize = (typeSizes[type] || 1) * numValues;
    const valueOffset = valueSize <= 4
      ? entryOffset + 8
      : tiffStart + view.getUint32(entryOffset + 8, littleEndian);

    if (valueOffset < 0 || valueOffset + valueSize > view.byteLength) continue;

    let value = null;
    if (type === 2) {
      value = readAscii(view, valueOffset, numValues);
    } else if (type === 3 && numValues === 1) {
      value = view.getUint16(valueOffset, littleEndian);
    } else if (type === 4 && numValues === 1) {
      value = view.getUint32(valueOffset, littleEndian);
    } else if ((type === 5 || type === 10) && numValues >= 1) {
      const arr = [];
      for (let n = 0; n < Math.min(numValues, 4); n += 1) {
        const num = type === 5 ? view.getUint32(valueOffset + n * 8, littleEndian) : view.getInt32(valueOffset + n * 8, littleEndian);
        const den = type === 5 ? view.getUint32(valueOffset + n * 8 + 4, littleEndian) : view.getInt32(valueOffset + n * 8 + 4, littleEndian);
        arr.push(den ? num / den : 0);
      }
      value = arr.length === 1 ? Number(arr[0].toFixed(4)) : arr;
    }

    fields[tag] = value;
  }
  return fields;
}

function dmsToDecimal(dms, ref) {
  if (!Array.isArray(dms) || dms.length < 3) return null;
  let dec = dms[0] + dms[1] / 60 + dms[2] / 3600;
  if (ref === 'S' || ref === 'W') dec = -dec;
  return Number(dec.toFixed(6));
}

export function parseJpegMetadata(buffer) {
  const view = new DataView(buffer);
  const meta = { format: 'JPEG', exif: {}, gps: null, markers: [] };
  if (view.byteLength < 4 || view.getUint16(0, false) !== 0xffd8) {
    return meta;
  }

  let offset = 2;
  while (offset + 4 < view.byteLength) {
    if (view.getUint8(offset) !== 0xff) break;
    const marker = view.getUint8(offset + 1);
    if (marker === 0xda || marker === 0xd9) break;
    const segmentLength = view.getUint16(offset + 2, false);
    if (segmentLength < 2) break;

    if (marker === 0xe1 && offset + 10 < view.byteLength) {
      const header = readAscii(view, offset + 4, 6);
      if (header === 'Exif') {
        const tiffStart = offset + 10;
        const endianMark = view.getUint16(tiffStart, false);
        const littleEndian = endianMark === 0x4949;
        const firstIfdOffset = view.getUint32(tiffStart + 4, littleEndian);
        const ifd0 = parseIfd(view, tiffStart, firstIfdOffset, littleEndian);

        for (const [tagHex, val] of Object.entries(ifd0)) {
          const tagNum = Number(tagHex);
          const name = EXIF_TAGS[tagNum];
          if (name && tagNum !== 0x8769 && tagNum !== 0x8825 && val !== null && val !== '') {
            meta.exif[name] = val;
          }
        }

        if (typeof ifd0[0x8769] === 'number') {
          const sub = parseIfd(view, tiffStart, ifd0[0x8769], littleEndian);
          for (const [tagHex, val] of Object.entries(sub)) {
            const name = EXIF_TAGS[Number(tagHex)];
            if (name && val !== null && val !== '') meta.exif[name] = val;
          }
        }

        if (typeof ifd0[0x8825] === 'number') {
          const gpsIfd = parseIfd(view, tiffStart, ifd0[0x8825], littleEndian);
          const lat = dmsToDecimal(gpsIfd[2], gpsIfd[1]);
          const lon = dmsToDecimal(gpsIfd[4], gpsIfd[3]);
          if (lat !== null && lon !== null) {
            meta.gps = { latitude: lat, longitude: lon };
          }
        }
      } else {
        meta.markers.push('APP1 (XMP/Extended)');
      }
    } else if (marker === 0xc0 || marker === 0xc2) {
      if (offset + 9 < view.byteLength) {
        meta.height = view.getUint16(offset + 5, false);
        meta.width = view.getUint16(offset + 7, false);
      }
    }
    offset += 2 + segmentLength;
  }
  return meta;
}

export function parsePngMetadata(buffer) {
  const view = new DataView(buffer);
  const meta = { format: 'PNG', chunks: [], textChunks: {} };
  if (view.byteLength < 24) return meta;
  let offset = 8;
  while (offset + 12 <= view.byteLength) {
    const length = view.getUint32(offset, false);
    const type = String.fromCharCode(
      view.getUint8(offset + 4),
      view.getUint8(offset + 5),
      view.getUint8(offset + 6),
      view.getUint8(offset + 7)
    );
    meta.chunks.push(type);
    const dataStart = offset + 8;
    if (type === 'IHDR' && length >= 8 && dataStart + 8 <= view.byteLength) {
      meta.width = view.getUint32(dataStart, false);
      meta.height = view.getUint32(dataStart + 4, false);
    } else if (type === 'tEXt' && length > 0 && dataStart + length <= view.byteLength) {
      const slice = new Uint8Array(buffer, dataStart, Math.min(length, 512));
      const nullIdx = slice.indexOf(0);
      if (nullIdx > 0) {
        const key = new TextDecoder().decode(slice.slice(0, nullIdx));
        const val = new TextDecoder().decode(slice.slice(nullIdx + 1));
        meta.textChunks[key] = val;
      }
    }
    if (type === 'IEND') break;
    offset += 12 + length;
  }
  return meta;
}

export async function stripImageMetadata(file) {
  const bitmapUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Unable to decode image locally.'));
      el.src = bitmapUrl;
    });
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);

    const outMime = file.type === 'image/png' ? 'image/png' : file.type === 'image/webp' ? 'image/webp' : 'image/jpeg';
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, outMime, 0.92));
    return {
      blob,
      mime: outMime,
      width: canvas.width,
      height: canvas.height
    };
  } finally {
    URL.revokeObjectURL(bitmapUrl);
  }
}
