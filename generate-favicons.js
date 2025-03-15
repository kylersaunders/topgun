import { favicons } from 'favicons';
import fs from 'fs/promises';
import path from 'path';

// Source SVG file
const source = 'public/favicon.svg';

// Configuration
const configuration = {
  path: './', // Path for generated files (relative)
  appName: 'Flight Simulator',
  appShortName: 'Flight',
  appDescription: 'Flight Simulator',
  background: '#3498db',
  theme_color: '#3498db',
  icons: {
    android: false,
    appleIcon: false,
    appleStartup: false,
    favicons: true,
    windows: false,
    yandex: false,
  },
};

// Generate favicons
console.log('Generating favicons...');

try {
  const response = await favicons(source, configuration);

  // Create public directory if it doesn't exist
  await fs.mkdir('public', { recursive: true });

  // Save files
  await Promise.all(
    response.images.map(async (image) => {
      await fs.writeFile(path.join('public', image.name), image.contents);
      console.log(`Generated: ${image.name}`);
    })
  );

  // Update HTML with favicon links
  const faviconHtml = response.html.join('\n  ');
  console.log('\nAdd the following to your HTML head section:');
  console.log(faviconHtml);

  console.log('\nFavicons generated successfully!');
} catch (error) {
  console.error('Error generating favicons:', error);
}
