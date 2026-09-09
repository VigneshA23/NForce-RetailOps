import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', (err) => errors.push(String(err)));
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(msg.text());
});

await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });

// Password visibility toggle
await page.fill('#email', 'priya.ramachandran@kedsicecream.com');
await page.fill('#password', 'Password123!');
const passwordInput = page.locator('#password');
console.log('password type before toggle:', await passwordInput.getAttribute('type'));
await page.click('button[aria-label="Show password"]');
console.log('password type after toggle:', await passwordInput.getAttribute('type'));

// Submit login
await page.click('button[type="submit"]');
await page.waitForTimeout(2500);
console.log('url after submit:', page.url());
const bodyText = await page.locator('body').innerText();
console.log('contains "Welcome"/"Home"/"Store"?', /welcome|home|store|dashboard/i.test(bodyText));

console.log('console/page errors:', errors.length ? errors : 'none');

await page.screenshot({ path: 'verify-login-post-submit.png' });
await browser.close();
