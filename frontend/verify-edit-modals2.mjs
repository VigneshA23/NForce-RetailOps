import { chromium } from 'playwright';

const BASE = 'http://localhost:5173';
const browser = await chromium.launch();

async function loginAs(page, email, password) {
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForSelector('#email', { timeout: 15000 });
  await page.fill('#email', email);
  await page.fill('#password', password);
  await page.click('button[type="submit"]');
}

// --- Owner: Store Inventory Config edit (Preferred Supplier) ---
const ownerPage = await browser.newPage({ viewport: { width: 1440, height: 900 } });
ownerPage.on('response', async (res) => {
  if (res.url().includes('/api/stores/inventory')) {
    let body = '';
    try { body = (await res.text()).slice(0, 200); } catch {}
    console.log(`${res.status()} ${res.url()} -> ${body}`);
  }
});
await loginAs(ownerPage, 'priya.ramachandran@kedsicecream.com', 'Password123!');
await ownerPage.waitForSelector('nav >> text=Inventory', { timeout: 20000 });
await ownerPage.waitForTimeout(1500);
await ownerPage.click('nav >> text=Inventory');
await ownerPage.waitForSelector('text=Loading', { state: 'detached', timeout: 15000 }).catch(() => {});
await ownerPage.waitForTimeout(800);
await ownerPage.screenshot({ path: 'edit-debug-storeinv-list.png' });
await ownerPage.click('button:has-text("Configure")', { timeout: 10000 });
await ownerPage.waitForTimeout(800);
await ownerPage.screenshot({ path: 'edit-03-storeinv-config.png' });
await ownerPage.close();

// --- Owner: Order List Entry edit (Supplier) ---
const orderPage = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await loginAs(orderPage, 'priya.ramachandran@kedsicecream.com', 'Password123!');
await orderPage.waitForSelector('nav >> text=Orders', { timeout: 20000 });
await orderPage.click('nav >> text=Orders');
await orderPage.waitForSelector('text=Loading', { state: 'detached', timeout: 15000 }).catch(() => {});
await orderPage.waitForTimeout(800);
await orderPage.click('button:has-text("Edit")');
await orderPage.waitForTimeout(800);
await orderPage.screenshot({ path: 'edit-04-orderentry.png' });
await orderPage.close();

// --- Super Admin: Inventory Item edit (Category) ---
const saPage = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await loginAs(saPage, 'superadmin@kedsicecream.com', 'Superadmin123');
await saPage.waitForSelector('nav >> text=Inventory', { timeout: 20000 });
await saPage.click('nav >> text=Inventory');
await saPage.waitForSelector('text=Loading', { state: 'detached', timeout: 15000 }).catch(() => {});
await saPage.waitForTimeout(800);
await saPage.click('button:has-text("Items")');
await saPage.waitForTimeout(800);
await saPage.screenshot({ path: 'edit-05-items-list.png' });
await saPage.click('.data-table tbody tr >> nth=0 >> button:has-text("Edit")');
await saPage.waitForTimeout(800);
await saPage.screenshot({ path: 'edit-06-item-modal.png' });
await saPage.close();

await browser.close();
console.log('done');
