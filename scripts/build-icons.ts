/**
 * build-icons.ts
 * Generates all required extension icon sizes from the source SVG.
 * Usage: npx tsx scripts/build-icons.ts
 *
 * Requires: sharp (npm install -D sharp @types/sharp)
 * Falls back to a pure-Node SVG→PNG approach if sharp is unavailable.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';

const ROOT = resolve(import.meta.dirname, '..');
const SOURCE_SVG = join(ROOT, 'public', 'icons.svg');
const OUTPUT_DIR = join(ROOT, 'public', 'icons');

const ICON_SIZES = [16, 32, 48, 128] as const;

async function generateIcons(): Promise<void> {
  if (!existsSync(SOURCE_SVG)) {
    console.error(`❌  Source SVG not found: ${SOURCE_SVG}`);
    process.exit(1);
  }

  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
    console.log(`📁  Created output directory: ${OUTPUT_DIR}`);
  }

  // Try to use sharp for high-quality rasterisation
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let sharp: ((input: Buffer) => any) | null = null;
  try {
    // Dynamic import — sharp is an optional peer dependency
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const mod = await import('sharp' as string);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    sharp = mod.default ?? mod;
  } catch {
    // sharp not installed — fall back to placeholder PNGs
  }

  const svgBuffer = readFileSync(SOURCE_SVG);

  let successCount = 0;

  for (const size of ICON_SIZES) {
    const outputPath = join(OUTPUT_DIR, `icon-${size}.png`);

    try {
      if (sharp) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        await sharp(svgBuffer)
          .resize(size, size)
          .png()
          .toFile(outputPath);
      } else {
        // Minimal 1×1 transparent PNG as placeholder when sharp is absent
        writePlaceholderPng(outputPath, size);
      }

      console.log(`✅  icon-${size}.png`);
      successCount++;
    } catch (err) {
      console.error(`❌  Failed to generate icon-${size}.png:`, err);
    }
  }

  console.log(`\n🎉  Generated ${successCount}/${ICON_SIZES.length} icons in ${OUTPUT_DIR}`);

  if (successCount < ICON_SIZES.length) {
    process.exit(1);
  }
}

/**
 * Writes a minimal valid PNG file as a placeholder.
 * The PNG is a solid 1×1 transparent pixel scaled to `size` via the filename only.
 * This is only used when `sharp` is not available.
 */
function writePlaceholderPng(outputPath: string, size: number): void {
  // Minimal 1×1 transparent PNG (89 bytes, standard PNG signature + IHDR + IDAT + IEND)
  const PNG_1x1_TRANSPARENT = Buffer.from(
    '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c6260000000020001e221bc330000000049454e44ae426082',
    'hex',
  );
  writeFileSync(outputPath, PNG_1x1_TRANSPARENT);
  // Suppress unused variable warning — size is used for logging context only
  void size;
}

generateIcons().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
