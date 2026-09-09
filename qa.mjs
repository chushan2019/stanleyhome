import puppeteer from 'puppeteer-core';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE = 'http://localhost:4321/stanleyhome';

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu', '--no-proxy-server'],
});

const targets = [
  { path: '/', name: 'home', desktop: true },
  { path: '/works', name: 'works', desktop: true },
  { path: '/works/glass-ui', name: 'work-detail', desktop: true },
  { path: '/notes', name: 'notes', desktop: true },
  { path: '/blog', name: 'blog', desktop: true },
  { path: '/about', name: 'about', desktop: true },
  { path: '/', name: 'home-mobile', mobile: true },
  { path: '/works', name: 'works-mobile', mobile: true },
];

for (const t of targets) {
  const page = await browser.newPage();
  await page.emulateMediaFeatures([
    { name: 'prefers-reduced-motion', value: 'reduce' },
  ]);
  await page.setViewport(
    t.mobile
      ? { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true }
      : { width: 1440, height: 900, deviceScaleFactor: 1 }
  );
  await page.goto(BASE + t.path, { waitUntil: 'load', timeout: 20000 });
  await page.evaluate(async () => {
    document.querySelectorAll('.sh-reveal').forEach((el) => el.classList.add('is-revealed'));
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  });
  await page.screenshot({ path: `/tmp/qa-${t.name}.png`, fullPage: true });
  const overflow = await page.evaluate(() => ({ vw: innerWidth, sw: document.documentElement.scrollWidth }));
  console.log(t.name, JSON.stringify(overflow), overflow.sw > overflow.vw + 1 ? 'H-OVERFLOW!' : 'ok');
  await page.close();
}

const page = await browser.newPage();
await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
await page.setViewport({ width: 1440, height: 900 });
await page.goto(BASE + '/', { waitUntil: 'networkidle0' });
await page.evaluate(() => {
  document.documentElement.setAttribute('data-theme', 'light');
  document.querySelectorAll('.sh-reveal').forEach((el) => el.classList.add('is-revealed'));
});
await new Promise((r) => setTimeout(r, 600));
await page.screenshot({ path: '/tmp/qa-home-light.png', fullPage: true });
console.log('light ok');
await page.close();

await browser.close();
