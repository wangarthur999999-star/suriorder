import { test, expect, Page } from '@playwright/test';
import path from 'path';

const BASE_URL = 'https://suriorder.onrender.com/admin/demo';
const SCREENSHOT_DIR = path.resolve(__dirname, 'screenshots');

interface TestError {
  step: string;
  message: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
}

const errors: TestError[] = [];

function recordError(page: Page, step: string, message: string, severity: TestError['severity'] = 'MEDIUM') {
  errors.push({ step, message, severity });
  console.log(`  [${severity}] ${step}: ${message}`);
}

async function screenshot(page: Page, name: string) {
  const filePath = path.join(SCREENSHOT_DIR, `${name}.png`);
  await page.screenshot({ path: filePath, fullPage: true });
  console.log(`  Screenshot saved: ${filePath}`);
  return filePath;
}

test.describe('SuriOrder Admin Panel - Critical User Journey', () => {
  test.setTimeout(120000);

  test('Login flow: Shop ID demo + PIN 1234', async ({ page }) => {
    const jsErrors: string[] = [];

    // Listen for JavaScript errors
    page.on('pageerror', (err) => {
      jsErrors.push(err.message);
      console.log(`  [JS ERROR] ${err.message}`);
    });

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        console.log(`  [CONSOLE ERROR] ${msg.text()}`);
      }
    });

    // =========================================================================
    // STEP 1: Navigate to admin page
    // =========================================================================
    console.log('\n=== STEP 1: Navigate to admin page ===');
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000); // SPA initial load

    // Check page loaded at all
    const pageTitle = await page.title();
    console.log(`  Page title: "${pageTitle}"`);

    // =========================================================================
    // STEP 2: Wait for login box
    // =========================================================================
    console.log('\n=== STEP 2: Wait for login box ===');
    let loginBoxVisible = false;
    try {
      await page.waitForSelector('#login-box', { state: 'visible', timeout: 15000 });
      loginBoxVisible = true;
      console.log('  Login box visible');
    } catch {
      // Try alternative selectors
      const loginBoxCount = await page.locator('#login-box').count();
      console.log(`  #login-box count: ${loginBoxCount}`);
      if (loginBoxCount > 0) {
        const isVisible = await page.locator('#login-box').isVisible();
        console.log(`  #login-box visible: ${isVisible}`);
      }
      recordError(page, 'LoginBox', '#login-box not visible after 15s', 'HIGH');
    }

    await screenshot(page, '01-login-page');

    // Check form elements exist
    const shopIdInput = page.locator('#login-shop-id');
    const pinInput = page.locator('#login-pin');
    const shopIdExists = (await shopIdInput.count()) > 0;
    const pinExists = (await pinInput.count()) > 0;
    console.log(`  #login-shop-id exists: ${shopIdExists}`);
    console.log(`  #login-pin exists: ${pinExists}`);

    if (!shopIdExists) recordError(page, 'LoginForm', '#login-shop-id not found', 'HIGH');
    if (!pinExists) recordError(page, 'LoginForm', '#login-pin not found', 'HIGH');

    // =========================================================================
    // STEP 3: Enter credentials
    // =========================================================================
    console.log('\n=== STEP 3: Enter Shop ID and PIN ===');
    if (shopIdExists && pinExists) {
      await shopIdInput.fill('demo');
      await pinInput.fill('1234');
      console.log('  Credentials filled');
    } else {
      // Try to find inputs by other means
      const inputs = page.locator('input');
      const inputCount = await inputs.count();
      console.log(`  Total input elements: ${inputCount}`);
      for (let i = 0; i < inputCount; i++) {
        const placeholder = await inputs.nth(i).getAttribute('placeholder');
        const id = await inputs.nth(i).getAttribute('id');
        const type = await inputs.nth(i).getAttribute('type');
        console.log(`  Input[${i}]: id="${id}" type="${type}" placeholder="${placeholder}"`);
      }
    }

    // =========================================================================
    // STEP 4: Click login button
    // =========================================================================
    console.log('\n=== STEP 4: Click login button ===');
    let loginClicked = false;
    // Try login buttons in order of preference
    const buttonSelectors = [
      '#login-box button',
      '#login-btn',
      'button:has-text("Inloggen")',
      'button',
      'input[type="submit"]',
    ];

    for (const sel of buttonSelectors) {
      const btn = page.locator(sel).first();
      const count = await btn.count();
      if (count > 0) {
        const isVisible = await btn.isVisible();
        const text = await btn.textContent().catch(() => '');
        console.log(`  Trying button: "${sel}" visible=${isVisible} text="${text?.trim()}"`);
        if (isVisible) {
          await btn.click();
          loginClicked = true;
          console.log(`  Clicked: ${sel}`);
          break;
        }
      }
    }

    if (!loginClicked) {
      recordError(page, 'LoginButton', 'Could not find or click login button', 'HIGH');
    }

    // =========================================================================
    // STEP 5: Wait for dashboard
    // =========================================================================
    console.log('\n=== STEP 5: Wait for dashboard ===');
    await page.waitForTimeout(3000); // Give SPA time to transition

    const dashboard = page.locator('#dashboard');
    const dashboardCount = await dashboard.count();
    console.log(`  #dashboard elements: ${dashboardCount}`);

    let dashboardVisible = false;
    try {
      await dashboard.waitFor({ state: 'visible', timeout: 15000 });
      dashboardVisible = await dashboard.isVisible();
      console.log(`  Dashboard visible: ${dashboardVisible}`);
    } catch {
      // Check if still on login (auth failed) or some other state
      const stillOnLogin = await page.locator('#login-box').isVisible().catch(() => false);
      console.log(`  Still on login page: ${stillOnLogin}`);
      if (stillOnLogin) {
        recordError(page, 'Auth', 'Login failed - still on login page after clicking login', 'HIGH');
      }
    }

    await screenshot(page, '02-dashboard');

    // =========================================================================
    // STEP 6: Verify dashboard stats
    // =========================================================================
    console.log('\n=== STEP 6: Verify dashboard content ===');

    // Check for stat cards
    const statSelectors = [
      { selector: '.stat-card', label: 'Stat cards' },
      { selector: '[class*="stat"]', label: 'Stat-like elements' },
      { selector: '.metric', label: 'Metrics' },
      { selector: '.card', label: 'Cards' },
    ];

    for (const { selector, label } of statSelectors) {
      const count = await page.locator(selector).count();
      console.log(`  ${label} (${selector}): ${count}`);
    }

    // Check for key text elements
    const keyTextPatterns = ['Vandaag', 'Omzet', 'Orders', 'Bestelling'];
    for (const pattern of keyTextPatterns) {
      const text = page.locator(`text=${pattern}`);
      const count = await text.count();
      console.log(`  Text "${pattern}" elements: ${count}`);
    }

    // Check order table
    const tableSelector = page.locator('table, [class*="table"], [class*="order"]');
    const tableCount = await tableSelector.count();
    console.log(`  Table-like elements: ${tableCount}`);

    // Check for empty state
    const emptyText = page.locator('text=Geen bestellingen, text=No orders, text=No bestelling');
    const emptyCount = await emptyText.count();
    console.log(`  Empty-state text elements: ${emptyCount}`);

    // Get all visible text for analysis
    const bodyText = await page.locator('body').innerText();
    const relevantLines = bodyText.split('\n').filter((l) => l.trim().length > 0).slice(0, 30);
    console.log('  Page body text (first 30 lines):');
    relevantLines.forEach((line, i) => console.log(`    [${i}] ${line.trim()}`));

    // =========================================================================
    // STEP 7: Click "Menu" tab
    // =========================================================================
    console.log('\n=== STEP 7: Navigate to Menu tab ===');
    const menuTab = page.locator('button:has-text("Menu"), a:has-text("Menu"), [class*="tab"]:has-text("Menu"), text=Menu');

    const menuTabCount = await menuTab.first().count();
    console.log(`  Menu tab candidates: ${menuTabCount}`);

    if (menuTabCount > 0) {
      try {
        await menuTab.first().click({ timeout: 5000 });
        console.log('  Clicked Menu tab');
        await page.waitForTimeout(2000);
      } catch (e) {
        recordError(page, 'MenuTab', `Could not click Menu tab: ${e}`, 'MEDIUM');
      }

      await screenshot(page, '03-menu-tab');

      // Check for menu items
      const menuItems = ['Nasi Goreng', 'Moksi Meti', 'Bami', 'Roti', 'Tjauw Min', 'Pom', 'Sauto'];
      for (const item of menuItems) {
        const itemEl = page.locator(`text=${item}`);
        const itemCount = await itemEl.count();
        console.log(`  Menu item "${item}": ${itemCount > 0 ? 'FOUND' : 'NOT FOUND'}`);
      }

      // Get menu text
      const menuText = await page.locator('body').innerText();
      const menuLines = menuText.split('\n').filter((l) => l.trim().length > 0).slice(0, 30);
      console.log('  Menu page body text (first 30 lines):');
      menuLines.forEach((line, i) => console.log(`    [${i}] ${line.trim()}`));
    } else {
      recordError(page, 'MenuTab', 'Menu tab not found', 'HIGH');
    }

    // =========================================================================
    // STEP 8: Click "Delen" (Share) tab
    // =========================================================================
    console.log('\n=== STEP 8: Navigate to Delen (Share) tab ===');
    const shareTab = page.locator('button:has-text("Delen"), a:has-text("Delen"), [class*="tab"]:has-text("Delen"), text=Delen');

    const shareTabCount = await shareTab.first().count();
    console.log(`  Share tab candidates: ${shareTabCount}`);

    if (shareTabCount > 0) {
      try {
        await shareTab.first().click({ timeout: 5000 });
        console.log('  Clicked Delen tab');
        await page.waitForTimeout(2000);
      } catch (e) {
        recordError(page, 'ShareTab', `Could not click Delen tab: ${e}`, 'MEDIUM');
      }

      await screenshot(page, '04-share-tab');

      // Check for share link
      const urlPattern = page.locator('text=/https?:\/\//');
      const urlCount = await urlPattern.count();
      console.log(`  URL-like elements: ${urlCount}`);

      const shareText = page.locator('body').innerText();
      const shareLines = shareText.split('\n').filter((l) => l.trim().length > 0).slice(0, 20);
      console.log('  Share page body text (first 20 lines):');
      shareLines.forEach((line, i) => console.log(`    [${i}] ${line.trim()}`));
    } else {
      recordError(page, 'ShareTab', 'Delen tab not found', 'HIGH');
    }

    // =========================================================================
    // STEP 9: Check for broken styling
    // =========================================================================
    console.log('\n=== STEP 9: Check styling and layout ===');
    await screenshot(page, '05-final-state');

    // Check viewport-appropriate sizing
    const viewport = page.viewportSize();
    console.log(`  Viewport: ${viewport?.width}x${viewport?.height}`);

    // Check overflow issues
    const htmlWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const htmlHeight = await page.evaluate(() => document.documentElement.scrollHeight);
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    console.log(`  Document scroll size: ${htmlWidth}x${htmlHeight}`);
    console.log(`  Body scroll width: ${bodyWidth}`);
    if (viewport && bodyWidth > viewport.width + 10) {
      recordError(page, 'Layout', `Horizontal overflow: body=${bodyWidth}px > viewport=${viewport.width}px`, 'MEDIUM');
    }

    // Check for unstyled elements (common indicators)
    const fontStacks = await page.evaluate(() => {
      const bodyFont = getComputedStyle(document.body).fontFamily;
      return bodyFont;
    });
    console.log(`  Body font-family: ${fontStacks}`);

    // =========================================================================
    // FINAL REPORT
    // =========================================================================
    console.log('\n╔══════════════════════════════════════╗');
    console.log('║          TEST REPORT                 ║');
    console.log('╚══════════════════════════════════════╝');

    console.log(`\nJavaScript Errors: ${jsErrors.length}`);
    jsErrors.forEach((e, i) => console.log(`  [${i + 1}] ${e}`));

    console.log(`\nTest Errors: ${errors.length}`);
    if (errors.length > 0) {
      errors.forEach((e, i) => console.log(`  [${i + 1}] [${e.severity}] ${e.step}: ${e.message}`));
    }

    const highErrors = errors.filter((e) => e.severity === 'HIGH');
    const mediumErrors = errors.filter((e) => e.severity === 'MEDIUM');

    console.log('\nSummary:');
    console.log(`  HIGH issues: ${highErrors.length}`);
    console.log(`  MEDIUM issues: ${mediumErrors.length}`);
    console.log(`  JS errors: ${jsErrors.length}`);
    console.log(`  Login OK: ${dashboardVisible}`);
    console.log(`  Screenshots saved to: ${SCREENSHOT_DIR}`);

    // Don't fail on medium issues, but fail on HIGH
    if (highErrors.length > 0) {
      // We use soft assertions to collect all issues
      expect(highErrors.length, `Found ${highErrors.length} HIGH severity issues`).toBe(0);
    }
  });
});
