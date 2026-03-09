import { existsSync } from 'fs';
import { mkdir, readdir } from 'fs/promises';
import { join } from 'path';
import sharp from 'sharp';

const ICONS_DIR = join(process.cwd(), 'public', 'icon');
const DEV_ICONS_DIR = join(process.cwd(), 'public', 'icon-dev');

/**
 * Generate DEV badge icons from original icons
 * Adds a red "DEV" label at the bottom-right corner
 */
async function generateDevIcons() {
  try {
    // Create output directory if not exists
    if (!existsSync(DEV_ICONS_DIR)) {
      await mkdir(DEV_ICONS_DIR, { recursive: true });
    }

    // Get all PNG files
    const files = await readdir(ICONS_DIR);
    const pngFiles = files.filter((f) => f.endsWith('.png'));

    console.log(`Found ${pngFiles.length} icon files`);

    for (const file of pngFiles) {
      const inputPath = join(ICONS_DIR, file);
      const outputPath = join(DEV_ICONS_DIR, file);

      // Read original image
      const image = sharp(inputPath);
      const metadata = await image.metadata();
      const width = metadata.width!;
      const height = metadata.height!;

      // Create DEV badge (red rectangle with white text)
      // Badge size proportional to icon size
      const badgeHeight = Math.floor(height * 0.3);
      const badgeWidth = Math.floor(width * 0.5);
      const badgeX = width - badgeWidth;
      const badgeY = height - badgeHeight;

      // Create SVG badge with text
      const svgBadge = `
        <svg width="${badgeWidth}" height="${badgeHeight}" xmlns="http://www.w3.org/2000/svg">
          <rect width="100%" height="100%" fill="#dc2626" rx="${Math.floor(badgeHeight * 0.2)}"/>
          <text 
            x="50%" 
            y="50%" 
            dominant-baseline="central" 
            text-anchor="middle"
            fill="white" 
            font-family="system-ui, -apple-system, sans-serif"
            font-weight="bold"
            font-size="${Math.floor(badgeHeight * 0.5)}"
          >DEV</text>
        </svg>
      `;

      // Composite the badge onto the original icon
      await image
        .composite([
          {
            input: Buffer.from(svgBadge),
            top: badgeY,
            left: badgeX,
          },
        ])
        .png()
        .toFile(outputPath);

      console.log(`✓ Generated ${file}`);
    }

    console.log('\n✓ All DEV icons generated successfully!');
  } catch (error) {
    console.error('Error generating DEV icons:', error);
    process.exit(1);
  }
}

generateDevIcons();
