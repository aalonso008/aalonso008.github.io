const fs = require('fs');

const site = (process.env.SITE_URL || 'https://aalonso008.github.io').replace(/\/$/, '');
const base = site + '/';

const manifest = {
  name: 'Tu Rutina — Gym 5 Días',
  short_name: 'Tu Rutina',
  description: 'Crea tu rutina de gym y registra tus pesos',
  id: base,
  start_url: './index.html',
  scope: './',
  display: 'standalone',
  background_color: '#0f0f0f',
  theme_color: '#0f0f0f',
  lang: 'es',
  icons: [
    {
      src: base + 'assets/icons/icon-192.png',
      sizes: '192x192',
      type: 'image/png',
      purpose: 'any',
    },
    {
      src: base + 'assets/icons/icon-512.png',
      sizes: '512x512',
      type: 'image/png',
      purpose: 'any',
    },
    {
      src: base + 'assets/icons/icon-maskable-512.png',
      sizes: '512x512',
      type: 'image/png',
      purpose: 'maskable',
    },
  ],
};

const json = JSON.stringify(manifest, null, 2) + '\n';
fs.writeFileSync('manifest.webmanifest', json);
fs.writeFileSync('manifest.json', json);
console.log('Manifest generado para', base);
