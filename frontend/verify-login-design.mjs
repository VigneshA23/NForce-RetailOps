import { chromium } from 'playwright';

const viewports = [
  { name: 'desktop-1440', width: 1440, height: 900 },
  { name: 'desktop-1920', width: 1920, height: 1080 },
  { name: 'tablet-768', width: 768, height: 1024 },
  { name: 'mobile-390', width: 390, height: 844 },
  { name: 'mobile-375', width: 375, height: 667 },
];

const browser = await chromium.launch();

for (const vp of viewports) {
  const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);

  // Check for horizontal overflow
  const overflow = await page.evaluate(() => {
    return {
      bodyScrollWidth: document.body.scrollWidth,
      windowInnerWidth: window.innerWidth,
      hasHOverflow: document.body.scrollWidth > window.innerWidth + 1,
    };
  });
  console.log(`${vp.name} (${vp.width}x${vp.height}): overflow=${JSON.stringify(overflow)}`);

  await page.screenshot({ path: `verify-login-${vp.name}.png`, fullPage: false });
  await page.close();
}

await browser.close();
console.log('done');
