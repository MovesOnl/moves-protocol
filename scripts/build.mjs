// Builds the site into dist/ (or MOVES_OUT). The register is read at build time and drives
// the static markup. MOVES_REGISTER points the build at another register file (used by the gates).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'vite';
import { validateRegister } from '../src/lib/register.js';
import { fillPlaceholders } from '../src/lib/render.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(root, 'src');
const out = path.resolve(process.env.MOVES_OUT || path.join(root, 'dist'));
const regPath = path.resolve(process.env.MOVES_REGISTER || path.join(src, 'register.json'));

export async function runBuild() {
  const reg = JSON.parse(fs.readFileSync(regPath, 'utf8'));
  const errors = validateRegister(reg);
  if (errors.length) throw new Error('register invalid:\n  ' + errors.join('\n  '));

  // tokens: favicon, manifest and theme colour are derived from the one tokens file
  const tokensCss = fs.readFileSync(path.join(src, 'tokens.css'), 'utf8');
  const token = (name) => {
    const m = new RegExp(`--${name}:\\s*([^;]+);`).exec(tokensCss);
    if (!m) throw new Error('token missing: ' + name);
    return m[1].trim();
  };
  const field = token('color-void');
  const mark = token('color-ground');
  const { POLYS } = JSON.parse(fs.readFileSync(path.join(root, 'scripts', 'brand-polys.json'), 'utf8'));

  const stage = path.join(root, '.build', 'public-' + path.basename(out));
  fs.rmSync(stage, { recursive: true, force: true });
  fs.mkdirSync(stage, { recursive: true });

  // 32x32 favicon: the brand mark, traced from the supplied logo, white on black. No comments in the file.
  fs.writeFileSync(
    path.join(stage, 'favicon.svg'),
    `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="${field}"/><g transform="translate(16 16) scale(0.0265) translate(-967 -967)" fill="${mark}" stroke="${mark}" stroke-width="30" stroke-linejoin="round">${POLYS}</g></svg>\n`
  );
  for (const f of fs.readdirSync(path.join(src, 'assets'))) fs.copyFileSync(path.join(src, 'assets', f), path.join(stage, f));
  fs.writeFileSync(path.join(stage, 'robots.txt'), 'User-agent: *\nAllow: /\n');
  fs.writeFileSync(
    path.join(stage, 'site.webmanifest'),
    JSON.stringify({ name: reg.records.name.value, short_name: reg.records.name.value, start_url: '/', display: 'standalone', background_color: field, theme_color: field, icons: [{ src: '/favicon.svg', sizes: '32x32', type: 'image/svg+xml' }, { src: '/icon-192.png', sizes: '192x192', type: 'image/png' }, { src: '/icon-512.png', sizes: '512x512', type: 'image/png' }] }, null, 2) + '\n'
  );
  fs.writeFileSync(path.join(stage, '_headers'), '/assets/*\n  Cache-Control: public, max-age=31536000, immutable\n/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n');

  await build({
    root: src,
    configFile: false,
    publicDir: stage,
    logLevel: 'warn',
    plugins: [{ name: 'register-markup', transformIndexHtml: { order: 'pre', handler: (html) => fillPlaceholders(html, reg) } }],
    build: {
      outDir: out,
      emptyOutDir: true,
      target: 'es2022',
      cssTarget: ['chrome122', 'safari17', 'firefox122'],
      license: false,
      chunkSizeWarningLimit: 900,
      rollupOptions: { input: { main: path.join(src, 'index.html'), credits: path.join(src, 'credits', 'index.html') } },
    },
  });
  fs.rmSync(stage, { recursive: true, force: true });
  for (const f of ['index.html', 'credits/index.html', 'favicon.svg', 'og.jpg', 'apple-touch-icon.png']) {
    if (!fs.existsSync(path.join(out, f))) throw new Error('missing build output: ' + f);
  }
  return out;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  runBuild().then((o) => console.log('built ->', path.relative(root, o) || o), (e) => { console.error(e.message); process.exit(1); });
}
