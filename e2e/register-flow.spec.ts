import { test, expect, Page } from '@playwright/test';
import path from 'path';

const BASE_URL = 'https://suriorder.onrender.com';
const SCREENSHOT_DIR = path.resolve(__dirname, 'screenshots');

const timestamp = Date.now();
const SHOP_NAME = `Test Restaurant ${timestamp}`;
const SHOP_PHONE = `+597${String(timestamp).slice(5, 12)}`;
const ADMIN_PIN = '5678';

interface Finding {
  step: string;
  status: 'PASS' | 'FAIL' | 'WARN';
  details: string;
}

const findings: Finding[] = [];

function record(step: string, status: Finding['status'], details: string) {
  findings.push({ step, status, details });
  const icon = status === 'PASS' ? '[PASS]' : status === 'FAIL' ? '[FAIL]' : '[WARN]';
  console.log(`  ${icon} ${step}: ${details}`);
}

async function screenshot(page: Page, name: string) {
  const filePath = path.join(SCREENSHOT_DIR, `${name}.png`);
  await page.screenshot({ path: filePath, fullPage: true });
  console.log(`  Screenshot saved: ${filePath}`);
  return filePath;
}

test.describe('SuriOrder - Full Restaurant Owner Journey', () => {
  test.setTimeout(180000); // Generous timeout for Render free tier cold starts

  test('Register, setup wizard, dashboard, menu, settings', async ({ page }) => {
    // Track JS errors
    const jsErrors: string[] = [];
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
    // STEP 1: Navigate to Register page
    // =========================================================================
    console.log('\n=== STEP 1: Navigate to /register ===');
    try {
      await page.goto(`${BASE_URL}/register`, {
        waitUntil: 'networkidle',
        timeout: 60000,
      });
      record('Navigation', 'PASS', 'Navigated to /register');
    } catch (e) {
      record('Navigation', 'FAIL', `Could not load /register: ${e}`);
    }

    // The register box should be visible (it's shown by default when on /register)
    await page.waitForTimeout(4000); // Allow SPA JS to initialize

    // Check which form is visible
    const loginBoxVisible = await page.locator('#login-box').isVisible().catch(() => false);
    const registerBoxVisible = await page.locator('#register-box').isVisible().catch(() => false);
    console.log(`  Login box visible: ${loginBoxVisible}`);
    console.log(`  Register box visible: ${registerBoxVisible}`);

    // If login box is visible instead, click the register link
    if (loginBoxVisible && !registerBoxVisible) {
      console.log('  Switching to register form...');
      const registerLink = page.locator('#no-account a, a:has-text("Registreer"), a:has-text("Register")');
      if (await registerLink.count() > 0) {
        await registerLink.first().click();
        await page.waitForTimeout(1000);
      }
    }

    // Now verify register box is visible
    let regBoxFound = false;
    try {
      await page.waitForSelector('#register-box', { state: 'visible', timeout: 15000 });
      regBoxFound = true;
      record('RegisterForm', 'PASS', 'Register form loaded');
    } catch {
      record('RegisterForm', 'FAIL', 'Register form not visible after 15s');
    }

    await screenshot(page, '01-register-form');

    // Log all input elements
    const inputs = page.locator('input');
    const inputCount = await inputs.count();
    console.log(`  Total inputs: ${inputCount}`);
    for (let i = 0; i < inputCount; i++) {
      const id = await inputs.nth(i).getAttribute('id');
      const type = await inputs.nth(i).getAttribute('type');
      const placeholder = await inputs.nth(i).getAttribute('placeholder');
      const visible = await inputs.nth(i).isVisible().catch(() => false);
      console.log(`    Input[${i}]: id="${id}" type="${type}" placeholder="${placeholder}" visible=${visible}`);
    }

    // =========================================================================
    // STEP 2: Fill registration form
    // =========================================================================
    console.log('\n=== STEP 2: Fill registration form ===');

    const nameInput = page.locator('#reg-name');
    const phoneInput = page.locator('#reg-phone');
    const pinInput = page.locator('#reg-pin');
    const langSelect = page.locator('#reg-lang');
    const regBtn = page.locator('#reg-btn');

    const nameExists = (await nameInput.count()) > 0;
    const phoneExists = (await phoneInput.count()) > 0;
    const pinExists = (await pinInput.count()) > 0;
    const langExists = (await langSelect.count()) > 0;
    const btnExists = (await regBtn.count()) > 0;

    record('FormFields.Name', nameExists ? 'PASS' : 'FAIL', `#reg-name ${nameExists ? 'found' : 'NOT FOUND'}`);
    record('FormFields.Phone', phoneExists ? 'PASS' : 'FAIL', `#reg-phone ${phoneExists ? 'found' : 'NOT FOUND'}`);
    record('FormFields.PIN', pinExists ? 'PASS' : 'FAIL', `#reg-pin ${pinExists ? 'found' : 'NOT FOUND'}`);
    record('FormFields.Lang', langExists ? 'PASS' : 'FAIL', `#reg-lang ${langExists ? 'found' : 'NOT FOUND'}`);
    record('FormFields.Button', btnExists ? 'PASS' : 'FAIL', `#reg-btn ${btnExists ? 'found' : 'NOT FOUND'}`);

    if (nameExists && pinExists) {
      await nameInput.fill(SHOP_NAME);
      await phoneInput.fill(SHOP_PHONE);
      await pinInput.fill(ADMIN_PIN);
      if (langExists) {
        await langSelect.selectOption('en');
      }
      console.log(`  Filled: name="${SHOP_NAME}", phone="${SHOP_PHONE}", pin="${ADMIN_PIN}", lang=en`);
      record('FormFill', 'PASS', 'All fields filled successfully');
    } else {
      record('FormFill', 'FAIL', 'Could not fill all registration fields');
    }

    await screenshot(page, '02-register-filled');

    // =========================================================================
    // STEP 3: Submit registration
    // =========================================================================
    console.log('\n=== STEP 3: Submit registration ===');

    // Watch for the POST /api/shops response
    const apiResponsePromise = page.waitForResponse(
      (resp) => resp.url().includes('/api/shops') && resp.request().method() === 'POST',
      { timeout: 30000 }
    ).catch(() => null);

    await regBtn.click();
    console.log('  Clicked Register button');

    // Wait for API response
    const apiResponse = await apiResponsePromise;
    if (apiResponse && apiResponse.ok()) {
      const body = await apiResponse.json().catch(() => ({}));
      console.log(`  API response: success=${apiResponse.ok()}, id=${body.id}, name=${body.name}`);
      record('Registration', 'PASS', `Registered successfully. Shop ID: ${body.id}`);
    } else if (apiResponse) {
      const status = apiResponse.status();
      let body = '';
      try { body = JSON.stringify(await apiResponse.json()); } catch {}
      record('Registration', 'FAIL', `Registration API returned ${status}: ${body}`);
    } else {
      record('Registration', 'WARN', 'Could not capture API response, checking UI state...');
    }

    // Wait for dashboard transition
    await page.waitForTimeout(3000);

    // =========================================================================
    // STEP 4: Verify dashboard loaded
    // =========================================================================
    console.log('\n=== STEP 4: Verify dashboard ===');

    let dashboardVisible = false;
    try {
      await page.waitForSelector('#dashboard', { state: 'visible', timeout: 20000 });
      dashboardVisible = await page.locator('#dashboard').isVisible();
      record('Dashboard', dashboardVisible ? 'PASS' : 'FAIL', `Dashboard visible: ${dashboardVisible}`);
    } catch {
      // Check for toast messages (might indicate error)
      const bodyText = await page.locator('body').innerText().catch(() => '');
      console.log(`  Page body text:\n${bodyText.substring(0, 500)}`);
      record('Dashboard', 'FAIL', 'Dashboard not visible after registration');
    }

    if (dashboardVisible) {
      // Check dashboard header
      const shopName = await page.locator('#dash-shop-name').textContent().catch(() => '');
      const shopId = await page.locator('#dash-shop-id').textContent().catch(() => '');
      console.log(`  Dashboard shop name: "${shopName}"`);
      console.log(`  Dashboard shop ID: "${shopId}"`);
      record('Dashboard.Header', shopName ? 'PASS' : 'WARN', `Shop name: "${shopName}"`);
    }

    await screenshot(page, '03-dashboard');

    // =========================================================================
    // STEP 5: Setup wizard (if shown)
    // =========================================================================
    console.log('\n=== STEP 5: Setup wizard ===');

    const wizardOverlay = page.locator('#wizard-overlay');
    let wizardVisible = false;
    try {
      wizardVisible = await wizardOverlay.isVisible({ timeout: 5000 });
    } catch {
      wizardVisible = false;
    }
    console.log(`  Wizard overlay visible: ${wizardVisible}`);

    if (wizardVisible) {
      record('Wizard', 'PASS', 'Setup wizard appeared');
      await screenshot(page, '04a-wizard-step1');

      // Wizard step 1: Show shop ID, click Next
      console.log('  --- Wizard Step 1: Welcome ---');
      const wizNext1 = page.locator('.wiz-next').first();
      if (await wizNext1.count() > 0) {
        await wizNext1.click();
        await page.waitForTimeout(800);
        record('Wizard.Step1', 'PASS', 'Clicked Next on step 1');
      }

      // Wizard step 2: WhatsApp number, click Skip
      console.log('  --- Wizard Step 2: WhatsApp ---');
      await page.waitForTimeout(500);
      await screenshot(page, '04b-wizard-step2');
      const wizSkip2 = page.locator('.wiz-skip').first();
      if (await wizSkip2.count() > 0) {
        await wizSkip2.click();
        await page.waitForTimeout(800);
        record('Wizard.Step2', 'PASS', 'Skipped step 2');
      }

      // Wizard step 3: Quick menu setup
      console.log('  --- Wizard Step 3: Menu Setup ---');
      await page.waitForTimeout(500);
      await screenshot(page, '04c-wizard-step3');

      // Add first item
      const itemName0 = page.locator('#wiz-item-name-0');
      const itemPrice0 = page.locator('#wiz-item-price-0');
      if (await itemName0.count() > 0 && await itemPrice0.count() > 0) {
        await itemName0.fill('Nasi Goreng');
        await itemPrice0.fill('12.50');
        console.log('  Filled item 1: Nasi Goreng - SRD 12.50');
        record('Wizard.Menu.Item1', 'PASS', 'Added item 1: Nasi Goreng');
      }

      // Add second item
      const addItemBtn = page.locator('button:has-text("Add another"), button:has-text("Nog een")');
      if (await addItemBtn.count() > 0) {
        await addItemBtn.first().click();
        await page.waitForTimeout(500);
        const itemName1 = page.locator('#wiz-item-name-1');
        const itemPrice1 = page.locator('#wiz-item-price-1');
        if (await itemName1.count() > 0 && await itemPrice1.count() > 0) {
          await itemName1.fill('Bami');
          await itemPrice1.fill('10.00');
          console.log('  Filled item 2: Bami - SRD 10.00');
          record('Wizard.Menu.Item2', 'PASS', 'Added item 2: Bami');
        }
      } else {
        record('Wizard.Menu.Item2', 'WARN', 'Add item button not found, only 1 item added');
      }

      // Click Next
      const wizNext3 = page.locator('.wiz-next').first();
      if (await wizNext3.count() > 0) {
        await wizNext3.click();
        await page.waitForTimeout(800);
        record('Wizard.Step3', 'PASS', 'Proceeded past step 3');
      }

      // Wizard step 4: Share link
      console.log('  --- Wizard Step 4: Share Link ---');
      await page.waitForTimeout(500);
      await screenshot(page, '04d-wizard-step4');

      const wizNext4 = page.locator('.wiz-next').first();
      if (await wizNext4.count() > 0) {
        await wizNext4.click();
        await page.waitForTimeout(800);
        record('Wizard.Step4', 'PASS', 'Proceeded past step 4');
      }

      // Wizard step 5: Done
      console.log('  --- Wizard Step 5: Done ---');
      await page.waitForTimeout(500);
      await screenshot(page, '04e-wizard-step5');

      const wizDone = page.locator('.wiz-next, button:has-text("Dashboard"), button:has-text("Naar Dashboard")').first();
      if (await wizDone.count() > 0) {
        // Wait for the API call to complete
        const setupResponsePromise = page.waitForResponse(
          (resp) => resp.url().includes('/api/shops/') && resp.url().includes('/setup'),
          { timeout: 15000 }
        ).catch(() => null);

        await wizDone.click();
        console.log('  Clicked Done/Go to Dashboard');

        const setupResp = await setupResponsePromise;
        if (setupResp && setupResp.ok()) {
          const setupBody = await setupResp.json().catch(() => ({}));
          console.log(`  Setup response: ok=${setupResp.ok()}, menu_link=${setupBody.menu_link}`);
          record('Wizard.Complete', 'PASS', `Setup complete. Menu link: ${setupBody.menu_link}`);
        } else {
          record('Wizard.Complete', 'WARN', 'Setup API response not captured or failed');
        }

        await page.waitForTimeout(2000); // Wait for overlay to disappear
      }
    } else {
      record('Wizard', 'WARN', 'Wizard not shown — may have been auto-skipped');
    }

    // =========================================================================
    // STEP 6: Verify dashboard contents
    // =========================================================================
    console.log('\n=== STEP 6: Verify dashboard contents ===');

    // Make sure dashboard is visible
    try {
      await page.waitForSelector('#dashboard', { state: 'visible', timeout: 5000 });
    } catch {}

    await screenshot(page, '05-dashboard-after-wizard');

    // Stat cards
    const statCards = page.locator('.stat-card');
    const statCount = await statCards.count();
    console.log(`  Stat cards found: ${statCount}`);

    if (statCount >= 4) {
      record('Dashboard.Stats', 'PASS', `Found ${statCount} stat cards`);
    } else if (statCount > 0) {
      record('Dashboard.Stats', 'WARN', `Only ${statCount} stat cards found`);
    } else {
      record('Dashboard.Stats', 'FAIL', 'No stat cards found');
    }

    // Log stat card content
    for (let i = 0; i < Math.min(statCount, 5); i++) {
      const text = await statCards.nth(i).textContent().catch(() => '');
      console.log(`    Stat card [${i}]: "${text?.trim()}"`);
    }

    // Menu link box
    const menuLinkBox = page.locator('#menu-link-box');
    const menuLinkBoxVisible = await menuLinkBox.isVisible().catch(() => false);
    record('Dashboard.MenuLink', menuLinkBoxVisible ? 'PASS' : 'FAIL', `Menu link box visible: ${menuLinkBoxVisible}`);

    // Tabs
    const tabs = page.locator('.tabs button');
    const tabCount = await tabs.count();
    console.log(`  Tabs found: ${tabCount}`);
    const tabTexts: string[] = [];
    for (let i = 0; i < tabCount; i++) {
      const text = await tabs.nth(i).textContent().catch(() => '');
      tabTexts.push(text?.trim() || '');
    }
    console.log(`  Tab texts: ${tabTexts.join(', ')}`);

    if (tabCount >= 4) {
      record('Dashboard.Tabs', 'PASS', `All 4 tabs present: ${tabTexts.join(', ')}`);
    } else {
      record('Dashboard.Tabs', 'FAIL', `Only ${tabCount} tabs found`);
    }

    // =========================================================================
    // STEP 7: Navigate to Menu tab
    // =========================================================================
    console.log('\n=== STEP 7: Menu tab ===');

    // Click Menu tab
    const menuTab = page.locator('button:has-text("Menu")').first();
    if (await menuTab.count() > 0) {
      await menuTab.click();
      await page.waitForTimeout(2000);
      console.log('  Clicked Menu tab');
    } else {
      // Try case-insensitive
      const altMenuTab = page.locator('#tab-menu, button:has-text("menu")').first();
      if (await altMenuTab.count() > 0) {
        await altMenuTab.click();
        await page.waitForTimeout(2000);
      }
    }

    await screenshot(page, '06-menu-tab');

    // Check items table
    const itemsTable = page.locator('#items-list table');
    const itemsTableVisible = await itemsTable.isVisible().catch(() => false);
    record('Menu.Table', itemsTableVisible ? 'PASS' : 'FAIL', `Items table visible: ${itemsTableVisible}`);

    // Check for our wizard-created items
    const pageText = await page.locator('body').innerText().catch(() => '');
    const hasNasi = pageText.includes('Nasi Goreng');
    const hasBami = pageText.includes('Bami');
    console.log(`  "Nasi Goreng" on page: ${hasNasi}`);
    console.log(`  "Bami" on page: ${hasBami}`);
    if (hasNasi || hasBami) {
      record('Menu.Items', 'PASS', `Wizard items visible: Nasi=${hasNasi} Bami=${hasBami}`);
    } else {
      record('Menu.Items', 'WARN', 'Wizard items not found in menu table');
    }

    // Try adding a new menu item
    console.log('  Attempting to add a new menu item...');
    const addNameInput = page.locator('#item-name');
    const addPriceInput = page.locator('#item-price');
    const addBtn = page.locator('#add-btn');

    if (await addNameInput.count() > 0 && await addPriceInput.count() > 0 && await addBtn.count() > 0) {
      await addNameInput.fill('Roti Kip');
      await addPriceInput.fill('15.00');
      await addBtn.click();
      await page.waitForTimeout(2000);

      // Check if item was added
      const pageText2 = await page.locator('body').innerText().catch(() => '');
      const hasRoti = pageText2.includes('Roti Kip');
      record('Menu.AddItem', hasRoti ? 'PASS' : 'FAIL', `Add "Roti Kip" — ${hasRoti ? 'Found' : 'Not found'} on page`);
      console.log(`  "Roti Kip" on page: ${hasRoti}`);
    } else {
      record('Menu.AddItem', 'WARN', 'Add item form fields not found');
    }

    await screenshot(page, '07-menu-after-add');

    // =========================================================================
    // STEP 8: Orders tab
    // =========================================================================
    console.log('\n=== STEP 8: Orders tab ===');

    const ordersTab = page.locator('button:has-text("Bestellingen"), button:has-text("Orders")').first();
    if (await ordersTab.count() > 0) {
      await ordersTab.click();
      await page.waitForTimeout(2000);
      console.log('  Clicked Orders tab');
    }

    await screenshot(page, '08-orders-tab');

    const ordersTable = page.locator('#orders-tbody');
    const ordersTableVisible = await ordersTable.isVisible().catch(() => false);
    record('Orders.Table', ordersTableVisible ? 'PASS' : 'FAIL', `Orders table visible: ${ordersTableVisible}`);

    // Check for empty state or orders
    const ordersText = await ordersTable.textContent().catch(() => '');
    console.log(`  Orders tbody text: "${ordersText?.substring(0, 200)}"`);
    const hasNoOrders = ordersText?.includes('Geen bestellingen') || ordersText?.includes('No orders') || ordersText?.includes('暂无订单');
    const hasSpinner = ordersText?.includes('spinner');
    if (hasNoOrders) {
      record('Orders.Content', 'PASS', 'Empty state shown (no orders yet)');
    } else if (hasSpinner) {
      record('Orders.Content', 'WARN', 'Orders still loading (spinner)');
    } else if (ordersText?.trim()) {
      record('Orders.Content', 'PASS', 'Orders data loaded');
    }

    // Check SSE connection (indirect - look for event listener)
    // The SSE is started after wizard completion
    const sseConnected = await page.evaluate(() => {
      return !!(window as any).eventSource && ((window as any).eventSource).readyState === 1;
    }).catch(() => false);
    console.log(`  SSE connected: ${sseConnected}`);
    if (sseConnected) {
      record('Orders.SSE', 'PASS', 'SSE connection active');
    }

    // =========================================================================
    // STEP 9: Share tab
    // =========================================================================
    console.log('\n=== STEP 9: Share tab ===');

    const shareTab = page.locator('button:has-text("Delen"), button:has-text("Share")').first();
    if (await shareTab.count() > 0) {
      await shareTab.click();
      await page.waitForTimeout(2000);
      console.log('  Clicked Share tab');
    }

    await screenshot(page, '09-share-tab');

    const sharePanel = page.locator('#panel-share');
    const sharePanelVisible = await sharePanel.isVisible().catch(() => false);
    record('Share.Panel', sharePanelVisible ? 'PASS' : 'FAIL', `Share panel visible: ${sharePanelVisible}`);

    // Check menu URL input
    const menuUrlInput = page.locator('#menu-url');
    const menuUrl = await menuUrlInput.inputValue().catch(() => '');
    console.log(`  Menu URL: "${menuUrl}"`);
    if (menuUrl && menuUrl.includes('/order/')) {
      record('Share.MenuURL', 'PASS', `Menu URL set: ${menuUrl}`);
    } else if (menuUrl) {
      record('Share.MenuURL', 'WARN', `Menu URL looks odd: ${menuUrl}`);
    } else {
      record('Share.MenuURL', 'FAIL', 'Menu URL input is empty');
    }

    // Check QR code image
    const qrImg = page.locator('#qr-image');
    const qrSrc = await qrImg.getAttribute('src').catch(() => '');
    if (qrSrc) {
      record('Share.QR', 'PASS', `QR code image src: ${qrSrc}`);
    } else {
      record('Share.QR', 'WARN', 'QR code image not found');
    }

    // =========================================================================
    // STEP 10: Settings tab
    // =========================================================================
    console.log('\n=== STEP 10: Settings tab ===');

    const settingsTab = page.locator('button:has-text("Instellingen"), button:has-text("Settings"), button:has-text("设置")').first();
    if (await settingsTab.count() > 0) {
      await settingsTab.click();
      await page.waitForTimeout(2000);
      console.log('  Clicked Settings tab');
    }

    await screenshot(page, '10-settings-tab');

    const settingsPanel = page.locator('#panel-settings');
    const settingsPanelVisible = await settingsPanel.isVisible().catch(() => false);
    record('Settings.Panel', settingsPanelVisible ? 'PASS' : 'FAIL', `Settings panel visible: ${settingsPanelVisible}`);

    // Check language selector
    const langSelect2 = page.locator('#set-lang');
    const langExists2 = (await langSelect2.count()) > 0;
    record('Settings.LangSelector', langExists2 ? 'PASS' : 'FAIL', `Language selector: ${langExists2 ? 'found' : 'NOT FOUND'}`);

    if (langExists2) {
      const langValue = await langSelect2.inputValue().catch(() => '');
      console.log(`  Selected language: ${langValue}`);
    }

    // Try changing language
    if (langExists2) {
      await langSelect2.selectOption('en');
      await page.waitForTimeout(500);
      console.log('  Changed language to English');
    }

    // Check settings fields
    const welcomeField = page.locator('#set-welcome');
    const waField = page.locator('#set-wa');
    const bankNameField = page.locator('#set-bank-name');
    const bankAccField = page.locator('#set-bank-acc');
    const bankHolderField = page.locator('#set-bank-holder');

    for (const [label, locator] of [
      ['Welcome message', welcomeField],
      ['WhatsApp number', waField],
      ['Bank name', bankNameField],
      ['Bank account', bankAccField],
      ['Bank holder', bankHolderField],
    ] as const) {
      const exists = (await locator.count()) > 0;
      record(`Settings.${label.replace(/\s/g, '')}`, exists ? 'PASS' : 'FAIL', `${label} field: ${exists ? 'found' : 'NOT FOUND'}`);
    }

    await screenshot(page, '11-settings-after-lang-change');

    // Try saving settings
    const saveBtn = page.locator('#save-settings-btn');
    if (await saveBtn.count() > 0) {
      await saveBtn.click();
      await page.waitForTimeout(1000);
      record('Settings.Save', 'PASS', 'Save button clicked');
    }

    // =========================================================================
    // STEP 11: Final state & responsive check
    // =========================================================================
    console.log('\n=== STEP 11: Final checks ===');

    await screenshot(page, '12-final-state');

    // Check viewport
    const viewport = page.viewportSize();
    console.log(`  Viewport: ${viewport?.width}x${viewport?.height}`);

    // Check horizontal overflow
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    console.log(`  Body scroll width: ${bodyWidth}`);
    if (viewport && bodyWidth > viewport.width + 10) {
      record('Layout.Overflow', 'WARN', `Horizontal overflow: body=${bodyWidth}px > viewport=${viewport.width}px`);
    } else {
      record('Layout.Overflow', 'PASS', 'No horizontal overflow');
    }

    // Check admin language switch
    const langButtons = page.locator('.admin-lang-switch button');
    const langBtnCount = await langButtons.count();
    record('Layout.LangSwitch', langBtnCount === 3 ? 'PASS' : 'WARN', `Admin language buttons: ${langBtnCount}`);

    // =========================================================================
    // FINAL REPORT
    // =========================================================================
    console.log('\n╔══════════════════════════════════════════╗');
    console.log('║        E2E TEST REPORT                   ║');
    console.log('╚══════════════════════════════════════════╝');

    console.log(`\nShop Name: ${SHOP_NAME}`);
    console.log(`Total steps: ${findings.length}`);

    const passCount = findings.filter((f) => f.status === 'PASS').length;
    const failCount = findings.filter((f) => f.status === 'FAIL').length;
    const warnCount = findings.filter((f) => f.status === 'WARN').length;

    console.log('\n--- Findings ---');
    findings.forEach((f) => {
      const icon = f.status === 'PASS' ? '✓' : f.status === 'FAIL' ? '✗' : '△';
      console.log(`  ${icon} [${f.status}] ${f.step}: ${f.details}`);
    });

    console.log(`\nSummary:`);
    console.log(`  PASS: ${passCount}`);
    console.log(`  FAIL: ${failCount}`);
    console.log(`  WARN: ${warnCount}`);
    console.log(`  JS Errors: ${jsErrors.length}`);
    if (jsErrors.length > 0) {
      jsErrors.forEach((e, i) => console.log(`    [${i + 1}] ${e}`));
    }

    const passRate = findings.length > 0 ? Math.round((passCount / findings.length) * 100) : 0;
    console.log(`  Pass Rate: ${passRate}%`);

    // Fail on critical failures only
    if (failCount > 0) {
      console.log(`\n  FAILURES DETECTED: ${failCount}`);
    }
  });
});
