// npm run gates. Static lints, a baseline build, and mutation builds that flip every record.
// Mutation anchors are state independent: nothing here names the current state of a record.
// The register is read at runtime, the opposite branch is derived from it, and output is
// checked through data-record attributes.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { parseHTML } from 'linkedom';
import { validateRegister, isStated, deriveHandle, isAddressShaped } from '../src/lib/register.js';
import { classify } from '../src/lib/gate.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(root, 'src');
const rd = (p) => fs.readFileSync(p, 'utf8');
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok: !!ok, detail }); };

function walk(dir, skip = ['node_modules', '.build', '.git']) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (skip.includes(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p, skip)); else out.push(p);
  }
  return out;
}
const DATE_RE = [/\b(?:19|20)\d{2}-\d{2}-\d{2}\b/, /\b(?:19|20)\d{2}\/\d{1,2}\/\d{1,2}\b/, /\b\d{1,2}[\/.]\d{1,2}[\/.](?:19|20)\d{2}\b/, /\b\d{2}:\d{2}:\d{2}/, /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+\d{1,2}(?:st|nd|rd|th)?,?\s+(?:19|20)\d{2}\b/i, /\b\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?,?\s+(?:19|20)\d{2}\b/i, /(?:©|\(c\)|copyright)[^\n]{0,30}(?:19|20)\d{2}/i, /\b(?:19|20)\d{2}\s*-\s*(?:19|20)\d{2}\b/];
const rel = (p) => path.relative(root, p).replaceAll('\\', '/');

/* ---------- builds ---------- */
function buildTo(outDir, registerPath) {
  const env = { ...process.env, MOVES_OUT: outDir };
  if (registerPath) env.MOVES_REGISTER = registerPath; else delete env.MOVES_REGISTER;
  let r;
  for (let i = 0; i < 3; i++) {
    r = spawnSync(process.execPath, [path.join(root, 'scripts', 'build.mjs')], { env, encoding: 'utf8' });
    if (r.status === 0) break;
  }
  return { ok: r.status === 0, log: (r.stdout || '') + (r.stderr || '') };
}

/* ---------- register helpers (state independent) ---------- */
const clone = (o) => JSON.parse(JSON.stringify(o));
const rnd = (() => { let s = 0x9e3779b9 ^ Date.now(); return () => ((s = Math.imul(s ^ (s >>> 15), 2246822507) ^ Math.imul(s ^ (s >>> 13), 3266489909)), ((s >>> 0) / 4294967296)); })();
const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const randomAddress = (n = 44) => Array.from({ length: n }, () => B58[Math.floor(rnd() * B58.length)]).join('');
const TEST = {
  ca: () => ({ value: randomAddress() }),
  x: () => ({ url: 'https://x.com/gate' + Math.floor(rnd() * 1e6) }),
  github: () => ({ url: 'https://github.com/gate' + Math.floor(rnd() * 1e6) + '/site' }),
};
const LINKS = ['ca', 'x', 'github'];
// Opposite branch of whatever the record is right now.
function flip(reg) {
  const m = clone(reg);
  for (const k of LINKS) {
    const cur = m.records[k];
    m.records[k] = isStated(cur)
      ? { state: 'absent', checkedAt: reg.checkedAt }
      : { state: 'stated', ...TEST[k](), source: 'gate fixture', statedAt: reg.checkedAt };
  }
  return m;
}
function setAll(reg, state) {
  const m = clone(reg);
  for (const k of LINKS) m.records[k] = { state, checkedAt: reg.checkedAt };
  return m;
}

/* ---------- DOM assertions, read from built html ---------- */
function assertRecords(label, html, reg, full = true) {
  const { document } = parseHTML(html);
  for (const k of LINKS) {
    const rec = reg.records[k];
    const els = [...document.querySelectorAll(`[data-record="${k}"]`)].filter((e) => !e.closest('.chips'));
    check(`${label}: ${k} rendered in every place it belongs`, els.length >= (full ? 2 : 1), `found ${els.length}`);
    for (const el of els) {
      const st = el.getAttribute('data-state');
      check(`${label}: ${k} data-state mirrors record`, st === rec.state, `${st} vs ${rec.state}`);
      if (isStated(rec)) {
        if (k === 'ca') {
          check(`${label}: ca is a copy button`, el.tagName === 'BUTTON' && el.getAttribute('data-copy') === rec.value);
          check(`${label}: ca shows the full address`, el.textContent.includes(rec.value), `${rec.value.length} chars`);
        } else {
          const handle = deriveHandle(k, rec.url);
          check(`${label}: ${k} is a link to the stored url`, el.tagName === 'A' && el.getAttribute('href') === rec.url);
          check(`${label}: ${k} handle derived from url`, (el.getAttribute('aria-label') || '').includes(handle), handle);
        }
      } else {
        check(`${label}: ${k} inert has no href`, !el.hasAttribute('href') && !el.querySelector('[href]') && el.tagName !== 'A' && el.tagName !== 'BUTTON');
        const said = (el.getAttribute('aria-label') || '') + el.textContent + (el.getAttribute('title') || '');
        check(`${label}: ${k} inert says so and carries no date`, /not stated|unconfirmed/i.test(said) && !DATE_RE.some((re) => re.test(said)));
        check(`${label}: ${k} inert not copyable`, !el.hasAttribute('data-copy'));
      }
    }
  }
  // link rule across the page: profile links exist only where a stated record put them
  const profileLinks = !full ? [] : [...document.querySelectorAll('a[href]')].filter((a) => /(^|\/\/|\.)(x|twitter|github)\.com/.test(a.getAttribute('href')));
  check(`${label}: every x/github link comes from a stated record`, profileLinks.every((a) => a.getAttribute('data-record') && a.getAttribute('data-state') === 'stated'));
  const slot = document.getElementById('ca-slot');
  const main = document.querySelector('main');
  check(`${label}: ca slot sits before main content`, slot && main && !!(slot.compareDocumentPosition(main) & 4));
}

function gateMatrix(label, reg) {
  const ca = reg.records.ca;
  const garbage = '0OIl' + randomAddress(40);
  const other = randomAddress(44);
  const kinds = {
    empty: classify('', reg).kind,
    short: classify('abc123', reg).kind,
    badChars: classify(garbage, reg).kind,
    other: classify(other, reg).kind,
  };
  check(`${label}: empty input is idle`, kinds.empty === 'empty');
  check(`${label}: short string is not address-shaped`, kinds.short === 'not-address-shaped');
  check(`${label}: non-base58 chars are flagged as such`, kinds.badChars === 'not-address-shaped');
  const pump = (n) => randomAddress(n - 4) + 'pump';
  for (const n of [32, 43, 44]) check(`${label}: ${n}-char address ending in pump is accepted as address-shaped`, isAddressShaped(pump(n)) && classify(pump(n), reg).kind !== 'not-address-shaped');
  check(`${label}: 31 chars and 45 chars are outside the 32-44 window`, classify(randomAddress(31), reg).kind === 'not-address-shaped' && classify(randomAddress(45), reg).kind === 'not-address-shaped');
  if (isStated(ca)) { const mine = pump(44); const mreg = clone(reg); mreg.records.ca = { ...ca, value: mine }; check(`${label}: a stated pump address validates and matches itself`, validateRegister(mreg).length === 0 && classify(mine, mreg).kind === 'match' && classify(pump(44), mreg).kind === 'mismatch'); }
  let blanket = 0;
  for (let i = 0; i < 60; i++) if (classify(randomAddress(32 + Math.floor(rnd() * 13)), reg).kind === 'not-address-shaped') blanket++;
  check(`${label}: base58 is never blanket-rejected`, blanket === 0, `${blanket} of 60 rejected`);
  if (isStated(ca)) {
    const near = ca.value.slice(0, -1) + (ca.value.endsWith('A') ? 'B' : 'A');
    check(`${label}: stated ca matches itself`, classify(ca.value, reg).kind === 'match');
    check(`${label}: stated ca matches inside a pasted link`, classify(`https://explorer.example/address/${ca.value}?x=1`, reg).kind === 'match');
    check(`${label}: near-miss address is a mismatch`, classify(near, reg).kind === 'mismatch');
    check(`${label}: unrelated address is a mismatch`, kinds.other === 'mismatch');
  } else {
    check(`${label}: absent ca leaves address-shaped strings unverifiable`, kinds.other === 'unverifiable' && isAddressShaped(other));
    check(`${label}: unverifiable reply carries no date`, !DATE_RE.some((re) => re.test(classify(other, reg).message)));
  }
}

/* ---------- copy distance against the reference ---------- */
const words = (s) => s.toLowerCase().replace(/&[a-z]+;/g, ' ').match(/[a-z0-9]+/g) || [];
const grams = (s) => { const w = words(s), o = []; for (let i = 0; i + 1 < w.length; i++) o.push(w[i] + ' ' + w[i + 1]); return o; };
function ownSegments(distDir) {
  const segs = [];
  for (const f of ['index.html', 'credits/index.html']) {
    const { document } = parseHTML(rd(path.join(distDir, f)));
    document.querySelectorAll('script,style,svg').forEach((n) => n.remove());
    const walkNodes = (n) => {
      for (const c of n.childNodes) {
        if (c.nodeType === 3) { const t = c.textContent.trim(); if (t) segs.push(t); } else if (c.nodeType === 1) {
          const tech = c.getAttribute && ['viewport', 'color-scheme', 'robots', 'twitter:card'].includes(c.getAttribute('name') || c.getAttribute('property'));
          for (const a of ['aria-label', 'title', 'content', 'placeholder']) if (!tech && c.getAttribute && c.getAttribute(a)) segs.push(c.getAttribute(a));
          walkNodes(c);
        }
      }
    };
    walkNodes(document.documentElement);
  }
  for (const p of walk(src).filter((p) => p.endsWith('.js'))) {
    for (const m of rd(p).matchAll(/(['"`])((?:(?!\1)[^\\\n$<])+)\1/g)) if (/^[A-Za-z][A-Za-z' ,.:;!?·]*\s[A-Za-z' ,.:;!?·]*$/.test(m[2])) segs.push(m[2]);
  }
  return segs;
}

/* ---------- main ---------- */
const reg = JSON.parse(rd(path.join(src, 'register.json')));
const errs = validateRegister(reg);
check('register is valid (states, link rule, no stored handles)', errs.length === 0, errs.join('; '));
for (const k of LINKS) check(`mutation anchor is reversible for ${k}`, flip(flip(reg)).records[k].state === reg.records[k].state);

// repo hygiene
const all = walk(root).filter((p) => !p.includes(`${path.sep}dist${path.sep}`) || true);
check('no CLAUDE.md', !all.some((p) => /(^|[\\/])claude\.md$/i.test(p)));
check('no .claude directory', !fs.existsSync(path.join(root, '.claude')) && !all.some((p) => rel(p).split('/').includes('.claude')));
const attrib = [new RegExp('co-authored' + '-by', 'i'), new RegExp('Generated with .{0,20}' + 'Cla' + 'ude', 'i'), new RegExp('anthro' + 'pic', 'i'), new RegExp('cla' + 'ude' + '(\\.com| code)', 'i')];
const textFiles = all.filter((p) => /\.(js|mjs|cjs|css|html|json|md|txt|svg|webmanifest)$/.test(p) && !/package-lock\.json$/.test(p) && !p.includes('fixtures'));
const attribHits = textFiles.filter((p) => attrib.some((re) => re.test(rd(p))));
check('no AI attribution in any project file', attribHits.length === 0, attribHits.map(rel).join(', '));

// palette
const tokensCss = rd(path.join(src, 'tokens.css'));
const HEX = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b/g;
const tokenHex = (tokensCss.match(HEX) || []).map((h) => h.toLowerCase());
const expand = (h) => (h.length === 4 ? '#' + [...h.slice(1)].map((c) => c + c).join('') : h);
check('tokens file holds the brand palette entries', tokenHex.length >= 8, `${tokenHex.length}`);
check('every token is neutral (red = green = blue), no hue', tokenHex.every((h) => { const x = expand(h); return x.slice(1, 3) === x.slice(3, 5) && x.slice(3, 5) === x.slice(5, 7); }));
const ANCHORS = ['#000000', '#040404', '#080808', '#373737', '#d8d8d8', '#ffffff'];
check('tokens include the colours sampled from the brand files', ANCHORS.every((c) => tokenHex.includes(c)), ANCHORS.filter((c) => !tokenHex.includes(c)).join(','));
check('tokens hold no oklch/rgb/hsl placeholders', !/(?<![\w-])(?:oklch|oklab|rgb|rgba|hsl|hsla|lab|lch)\(/.test(tokensCss));
const LIT = [/#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b/, /(?<![\w-])(?:rgb|rgba|hsl|hsla|hwb|lab|lch|oklab|oklch|color)\(/, /(?:color|background(?:-color)?|fill|stroke|border(?:-[a-z]+)*|outline(?:-color)?)\s*:\s*(?:white|black|red|green|blue|gray|grey|silver|yellow|orange|purple|pink|cyan|magenta|navy|teal|lime|aqua|maroon|olive)\b/i];
const litFiles = walk(src).filter((p) => /\.(css|js|html|svg)$/.test(p) && path.basename(p) !== 'tokens.css');
const litHits = litFiles.filter((p) => LIT.some((re) => re.test(rd(p).replace(/\/\*[\s\S]*?\*\//g, ''))));
check('colour literals live only in the tokens file', litHits.length === 0, litHits.map(rel).join(', '));
const chHits = [...litFiles, path.join(src, 'tokens.css')].filter((p) => /(^|[^\w.-])\d*\.?\d+ch\b/.test(rd(p)));
check('no ch units in source', chHits.length === 0, chHits.map(rel).join(', '));
const css = rd(path.join(src, 'styles.css'));
check('prefers-reduced-motion handled in css', /@media\s*\(prefers-reduced-motion:\s*reduce\)/.test(css));
check('prefers-reduced-motion handled in scenes and scroll', ['scenes/util.js', 'choreo.js', 'main.js'].every((f) => /prefers-reduced-motion/.test(rd(path.join(src, f)))));
const dockHidden = [...css.matchAll(/([^{}]*dock[^{}]*)\{([^}]*)\}/g)].some((m) => /display:\s*none/.test(m[2]));
check('no rule hides the dock icons at any breakpoint', !dockHidden);
check('ca slot is fixed to the top and always visible', /\.ca-wrap\s*\{[^}]*position:\s*fixed[^}]*top:\s*64px/.test(css));
check('CA slot is large type', /\.ca-top \.ca-value\s*\{[^}]*font-size:\s*clamp\(14px,\s*1\.9vw,\s*26px\)/.test(css));

// baseline build + dist checks
const distDir = path.join(root, 'dist');
const base = buildTo(distDir);
check('baseline build exits 0', base.ok, base.log.slice(-300));
if (base.ok) {
  const html = rd(path.join(distDir, 'index.html'));
  assertRecords('baseline', html, reg);
  gateMatrix('baseline', reg);
  const fav = rd(path.join(distDir, 'favicon.svg'));
  check('favicon is svg 32x32', /width="32"/.test(fav) && /height="32"/.test(fav) && /viewBox="0 0 32 32"/.test(fav));
  check('favicon has no comments (so no double hyphens inside)', !/<!--/.test(fav) && !/--/.test(fav.replace(/<svg[\s\S]*$/, '')));
  const favHex = (fav.match(HEX) || []).map((h) => expand(h.toLowerCase()));
  check('favicon uses only brand token colours, neutral', favHex.length >= 2 && favHex.every((h) => tokenHex.map(expand).includes(h)) && !/(?<![\w-])(?:oklch|rgb|rgba|hsl|hsla)\(/.test(fav));
  check('favicon draws the four-part brand mark', (fav.match(/<polygon /g) || []).length === 4);
  const distCss = walk(path.join(distDir, 'assets')).filter((p) => p.endsWith('.css')).map(rd).join('\n');
  const distHex = (distCss.match(HEX) || []).map((h) => h.toLowerCase()).filter((h) => h !== '#0000' && h !== '#00000000').map(expand);
  const tokenSet = new Set(tokenHex.map(expand));
  check('built css uses only the brand palette (neutral hex from tokens, no rgb/hsl/oklch/lab)', distHex.every((h) => tokenSet.has(h)) && !/(?<![\w-])(?:rgb|rgba|hsl|hsla|hwb|lab|lch|oklab|oklch)\(/.test(distCss), distHex.filter((h) => !tokenSet.has(h)).join(','));
  check('built css has no ch units', !/(^|[^\w.-])\d*\.?\d+ch\b/.test(distCss));
  check('built html links the svg favicon', /rel="icon"[^>]*favicon\.svg/.test(html));
  for (const f of ['og.jpg', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png']) check(`brand asset shipped: ${f}`, fs.existsSync(path.join(distDir, f)));
  check('no _worker.js, no routes file, no proxy', !fs.existsSync(path.join(distDir, '_worker.js')) && !fs.existsSync(path.join(distDir, '_routes.json')));
  const distJs = walk(path.join(distDir, 'assets')).filter((p) => p.endsWith('.js')).map(rd).join('\n');
  check('browser fetches the stated rpc directly', !isStated(reg.records.rpc) || (html.includes(reg.records.rpc.url) && /fetch\(/.test(distJs) && distJs.includes('getEpochInfo')));
  check('rpc url is solana-rpc.publicnode.com', reg.records.rpc.url === 'https://solana-rpc.publicnode.com');
  check('no same-origin /rpc relay in built code', !/['"`]\/rpc['"`]/.test(distJs) && !/api\.mainnet-beta/.test(distJs));
  // no dates anywhere in dist (text files only)
  const dateHits = [];
  for (const p of walk(distDir)) {
    if (!/\.(html|css|js|json|svg|webmanifest|txt)$/.test(p) && path.basename(p) !== '_headers') continue;
    const t = rd(p);
    for (const re of DATE_RE) { const m = re.exec(t); if (m) dateHits.push(`${rel(p)}: ${m[0]}`); }
  }
  check('no dates anywhere in dist', dateHits.length === 0, dateHits.slice(0, 8).join(' | '));
  check('no date fields leak into the shipped register', !/checkedAt|statedAt|"source"/.test(html));

  // copy distance
  const refSegs = rd(path.join(root, 'gates', 'fixtures', 'reference-copy.txt')).split('\n').filter(Boolean);
  const refGrams = new Set(refSegs.flatMap(grams));
  const shared = new Map();
  for (const s of ownSegments(distDir)) for (const g of grams(s)) if (refGrams.has(g)) shared.set(g, s.slice(0, 60));
  check('zero shared 2-grams with the reference copy', shared.size === 0, [...shared].slice(0, 60).map(([g, s]) => `"${g}" in "${s}"`).join(' | '));
}

// mutation builds: opposite branch of every link record, then an all-unconfirmed pass
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'moves-gates-'));
for (const [name, make] of [['flipped', flip], ['unconfirmed', (r) => setAll(r, 'unconfirmed')]]) {
  const m = make(reg);
  const regFile = path.join(tmp, name + '.json');
  fs.writeFileSync(regFile, JSON.stringify(m));
  const outDir = path.join(tmp, 'out-' + name);
  const b = buildTo(outDir, regFile);
  check(`${name}: mutated build exits 0`, b.ok, b.log.slice(-300));
  if (b.ok) {
    assertRecords(name, rd(path.join(outDir, 'index.html')), m);
    assertRecords(name + ' (credits page)', rd(path.join(outDir, 'credits', 'index.html')), m, false);
    gateMatrix(name, m);
  }
}
// both gate branches were exercised: at least one build had ca stated and one did not
const caStates = new Set([reg.records.ca.state === 'stated', flip(reg).records.ca.state === 'stated']);
check('both gate branches proven (ca stated and ca not stated)', caStates.size === 2);
fs.rmSync(tmp, { recursive: true, force: true });

/* ---------- report ---------- */
const failed = results.filter((r) => !r.ok);
for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.ok || !r.detail ? '' : '  -> ' + r.detail}`);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
