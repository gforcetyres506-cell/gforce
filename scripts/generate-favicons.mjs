import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

// Helper to construct a standard multi-resolution ICO file from PNG buffers
function createIco(pngBuffers) {
  const count = pngBuffers.length;
  const headerSize = 6;
  const dirEntrySize = 16;
  let offset = headerSize + count * dirEntrySize;

  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // ICO type (1 = icon)
  header.writeUInt16LE(count, 4); // number of images

  const dirEntries = [];
  for (const img of pngBuffers) {
    const entry = Buffer.alloc(dirEntrySize);
    entry.writeUInt8(img.width >= 256 ? 0 : img.width, 0);
    entry.writeUInt8(img.height >= 256 ? 0 : img.height, 1);
    entry.writeUInt8(0, 2); // colors
    entry.writeUInt8(0, 3); // reserved
    entry.writeUInt16LE(1, 4); // color planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(img.buffer.length, 8); // size of image data
    entry.writeUInt32LE(offset, 12); // offset of image data
    offset += img.buffer.length;
    dirEntries.push(entry);
  }

  return Buffer.concat([header, ...dirEntries, ...pngBuffers.map((b) => b.buffer)]);
}

async function generateFavicons() {
  const logoPath = 'public/brand/g-force-tyres-logo.webp';
  if (!fs.existsSync(logoPath)) {
    throw new Error(`Approved logo asset not found at: ${logoPath}`);
  }

  const { data, info } = await sharp(logoPath).raw().toBuffer({ resolveWithObject: true });

  const getPixel = (x, y) => {
    const idx = (y * info.width + x) * info.channels;
    return [data[idx], data[idx + 1], data[idx + 2]];
  };

  // 1. Create clean binary mask of the blue G emblem
  const mask = new Uint8Array(info.width * info.height);

  for (let y = 180; y <= 700; y++) {
    for (let x = 20; x <= 600; x++) {
      // Exclude 'TYRES' text: begins at x >= 510, y >= 560
      if (x >= 510 && y >= 560) continue;
      // Exclude upper swoosh arc: begins at x >= 595, y <= 350
      if (x >= 595 && y <= 350) continue;

      const [r, g, b] = getPixel(x, y);
      // Blue pixel detection for G emblem
      if (b > 50 && b > r * 1.15 && b > g * 0.85) {
        mask[y * info.width + x] = 1;
      }
    }
  }

  // 2. Determine emblem bounding box
  let minX = info.width, maxX = 0, minY = info.height, maxY = 0;
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      if (mask[y * info.width + x]) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  const emblemW = maxX - minX + 1;
  const emblemH = maxY - minY + 1;
  console.log(`[generate-favicons] Cropped blue G bounds: x=[${minX}, ${maxX}] (w=${emblemW}), y=[${minY}, ${maxY}] (h=${emblemH})`);

  // 3. Create high-contrast square canvas with brand background #0D0D0D
  const emblemDim = Math.max(emblemW, emblemH);
  const pad = Math.round(emblemDim * 0.08); // 8% visual breathing padding
  const squareSize = emblemDim + pad * 2;
  const offsetX = Math.round((squareSize - emblemW) / 2);
  const offsetY = Math.round((squareSize - emblemH) / 2);

  const outChannels = 4;
  const outBuf = Buffer.alloc(squareSize * squareSize * outChannels, 0);

  // Fill with #0D0D0D (solid dark background matching brand)
  for (let i = 0; i < squareSize * squareSize; i++) {
    outBuf[i * 4] = 13;
    outBuf[i * 4 + 1] = 13;
    outBuf[i * 4 + 2] = 13;
    outBuf[i * 4 + 3] = 255;
  }

  // Copy masked pixels with their exact original colors
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      if (mask[y * info.width + x]) {
        const outX = offsetX + (x - minX);
        const outY = offsetY + (y - minY);
        const inIdx = (y * info.width + x) * info.channels;
        const outIdx = (outY * squareSize + outX) * outChannels;
        outBuf[outIdx] = data[inIdx];
        outBuf[outIdx + 1] = data[inIdx + 1];
        outBuf[outIdx + 2] = data[inIdx + 2];
        outBuf[outIdx + 3] = 255;
      }
    }
  }

  const baseImg = sharp(outBuf, { raw: { width: squareSize, height: squareSize, channels: 4 } });

  // 4. Generate all required resolutions
  const master512 = await baseImg.clone().resize(512, 512, { kernel: sharp.kernel.lanczos3 }).png().toBuffer();
  const icon192 = await baseImg.clone().resize(192, 192, { kernel: sharp.kernel.lanczos3 }).png().toBuffer();
  const apple180 = await baseImg.clone().resize(180, 180, { kernel: sharp.kernel.lanczos3 }).png().toBuffer();
  const icon96 = await baseImg.clone().resize(96, 96, { kernel: sharp.kernel.lanczos3 }).png().toBuffer();
  const icon48 = await baseImg.clone().resize(48, 48, { kernel: sharp.kernel.lanczos3 }).png().toBuffer();
  const icon32 = await baseImg.clone().resize(32, 32, { kernel: sharp.kernel.lanczos3 }).png().toBuffer();
  const icon16 = await baseImg.clone().resize(16, 16, { kernel: sharp.kernel.lanczos3 }).png().toBuffer();

  // Multi-resolution ICO: 16, 32, 48
  const icoBuf = createIco([
    { width: 16, height: 16, buffer: icon16 },
    { width: 32, height: 32, buffer: icon32 },
    { width: 48, height: 48, buffer: icon48 },
  ]);

  // Target paths:
  const files = {
    // Public directory
    'public/favicon.ico': icoBuf,
    'public/icon.png': master512,
    'public/icon-192.png': icon192,
    'public/icon-96.png': icon96,
    'public/icon-48.png': icon48,
    'public/icon-32.png': icon32,
    'public/icon-16.png': icon16,
    'public/apple-icon.png': apple180,
    'public/apple-touch-icon.png': apple180,
    // App router conventions
    'src/app/favicon.ico': icoBuf,
    'src/app/icon.png': master512,
    'src/app/apple-icon.png': apple180,
  };

  for (const [targetPath, buffer] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.writeFileSync(targetPath, buffer);
    console.log(`[generate-favicons] Wrote ${targetPath} (${buffer.length} bytes)`);
  }

  console.log('[generate-favicons] All favicon and icon assets generated successfully.');
}

generateFavicons().catch((err) => {
  console.error('[generate-favicons] Failed:', err);
  process.exitCode = 1;
});
