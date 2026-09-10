import { chromium } from 'playwright';

const BASE = 'http://localhost:5173';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

page.on('console', (msg) => { if (msg.type() === 'error') console.log('CONSOLE ERROR:', msg.text()); });

await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForSelector('#email', { timeout: 15000 });
await page.fill('#email', 'priya.ramachandran@kedsicecream.com');
await page.fill('#password', 'Password123!');
await page.click('button[type="submit"]');
await page.waitForSelector('nav >> text=Tasks', { timeout: 20000 });

await page.click('nav >> text=Tasks');
await page.waitForSelector('text=Loading tasks...', { state: 'detached', timeout: 15000 }).catch(() => {});
await page.waitForTimeout(500);
await page.screenshot({ path: 'edit-01-tasks-list.png' });

// First data row's pencil (edit) icon button in the ACTIONS column.
const editBtn = page.locator('.data-table tbody tr').first().locator('button').first();
const count = await editBtn.count();
console.log('Edit buttons found:', count);
if (count > 0) {
  await editBtn.click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'edit-02-task-modal.png' });

  const responseTypeVal = await page.locator('select').nth(0).inputValue().catch(() => 'N/A');
  const completionTypeVal = await page.locator('select').nth(1).inputValue().catch(() => 'N/A');
  console.log('Response Type select value:', responseTypeVal);
  console.log('Completion Type select value:', completionTypeVal);
}

await browser.close();
console.log('done');
