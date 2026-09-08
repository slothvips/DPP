import { readFile, writeFile } from 'node:fs/promises';
import sharp from 'sharp';

const root = new URL('../', import.meta.url);
const sizes = [16, 32, 48, 96, 128];
const checkOnly = process.argv.includes('--check');

// Paths keep the DEV label independent of fonts installed on the build machine.
const devBadge =
  Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
  <rect x="30" y="105" width="68" height="22" rx="8" fill="#EDE9FE"/>
  <g transform="translate(-27 5)" fill="none" stroke="#5741AE" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M68 105V118H72C80 118 80 105 72 105Z"/>
    <path d="M93 105H84V118H93M84 111.5H91"/>
    <path d="M100 105L105 118L110 105"/>
  </g>
</svg>`);
const devDot =
  Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
  <circle cx="64" cy="117" r="7" fill="#EDE9FE" stroke="#FFFFFF" stroke-width="4"/>
</svg>`);

async function generateIcons() {
  const source = await readFile(new URL('public/logo.svg', root));
  const base = await sharp(source, { density: 288 }).png().toBuffer();

  for (const directory of ['icon', 'icon-dev']) {
    for (const size of sizes) {
      let input = base;
      if (directory === 'icon-dev') {
        const overlay = await sharp(size < 48 ? devDot : devBadge)
          .resize(512, 512)
          .png()
          .toBuffer();
        input = await sharp(base)
          .composite([{ input: overlay }])
          .png()
          .toBuffer();
      }

      const output = await sharp(input).resize(size, size).png().toBuffer();
      const destination = new URL(`public/${directory}/${size}.png`, root);
      if (checkOnly) {
        const existing = await readFile(destination);
        if (!existing.equals(output)) {
          throw new Error(`Stale icon: ${destination.pathname}. Run pnpm icons:generate.`);
        }
      } else {
        await writeFile(destination, output);
      }
    }
  }
  console.info(`${checkOnly ? 'Verified' : 'Generated'} ${sizes.length * 2} DPP icons.`);
}

try {
  await generateIcons();
} catch (error) {
  console.error('DPP icon generation failed:', error);
  process.exitCode = 1;
}
