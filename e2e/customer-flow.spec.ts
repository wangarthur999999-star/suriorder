import { test, expect, Page } from '@playwright/test';
import path from 'path';

const BASE = 'https://suriorder.onrender.com';
const SCREENSHOT_DIR = path.resolve(__dirname, 'screenshots');

// Render free tier cold-start: be extremely patient
const COLD_START_MS = 90000;
const NAV_MS = 30000;
const ELEM_MS = 20000;

async function shot(page: Page, name: string) {
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, `cust-${name}.png`), fullPage: true });
}

test.describe('SuriOrder Customer Journey', () => {
  test.setTimeout(300000); // 5 min for cold starts

  test('Customer E2E: Homepage -> Browse Shop -> Add to Cart -> Checkout', async ({ page }) => {
    const findings: string[] = [];

    // =====================================================================
    // STEP 1: HOMEPAGE
    // =====================================================================
    console.log('\n=== STEP 1: Homepage ===');
    await page.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: COLD_START_MS });
    // Wait for the SPA to fully initialize
    await page.waitForLoadState('networkidle', { timeout: COLD_START_MS }).catch(() => {
      findings.push('MEDIUM: networkidle never reached on homepage');
    });

    const title = await page.title();
    console.log(`  Page title: "${title}"`);
    expect(title).toContain('SuriOrder');

    // 1a. Hero section
    const heroH1 = page.locator('.hero h1');
    await expect(heroH1).toBeVisible({ timeout: ELEM_MS });
    const heroText = await heroH1.textContent();
    console.log(`  Hero H1: "${heroText}"`);
    expect(heroText).toContain('SuriOrder');

    // 1b. CTA buttons
    const ctaOrder = page.locator('#cta-order');
    const ctaRegister = page.locator('#cta-register');
    await expect(ctaOrder).toBeVisible();
    await expect(ctaRegister).toBeVisible();
    console.log(`  CTA buttons visible: Order=${await ctaOrder.isVisible()} Register=${await ctaRegister.isVisible()}`);

    // 1c. Language switcher on homepage
    const langBtns = page.locator('.lang-row button');
    const langCount = await langBtns.count();
    console.log(`  Language buttons: ${langCount}`);
    expect(langCount).toBeGreaterThanOrEqual(3); // NL, EN, ZH

    // 1d. "How it works" section
    const howTitle = page.locator('#how-title');
    await expect(howTitle).toBeVisible();
    console.log(`  How it works title: "${await howTitle.textContent()}"`);

    const steps = page.locator('.step');
    const stepCount = await steps.count();
    console.log(`  Steps visible: ${stepCount}`);
    expect(stepCount).toBe(3);

    // 1e. Search bar
    const searchInput = page.locator('#search-input');
    await expect(searchInput).toBeVisible();
    console.log(`  Search bar visible: ${await searchInput.isVisible()}`);

    // 1f. Shop cards load (from /api/shops)
    // Wait for skeleton to disappear and shop cards to appear
    await page.waitForTimeout(2000); // Give fetch time to complete
    const shopCards = page.locator('.shop-card');
    try {
      await shopCards.first().waitFor({ state: 'visible', timeout: NAV_MS });
      const shopCount = await shopCards.count();
      console.log(`  Shop cards loaded: ${shopCount}`);
      expect(shopCount).toBeGreaterThan(0);
    } catch {
      // Maybe no shops registered or empty state
      const emptyState = page.locator('.empty-state');
      const isEmpty = await emptyState.isVisible().catch(() => false);
      if (isEmpty) {
        findings.push('MEDIUM: No restaurants found (empty state) - this may be expected for fresh deploys');
        console.log('  No shop cards - empty state shown');
      } else {
        findings.push('HIGH: Shop cards never loaded and no empty state visible');
        console.log('  ERROR: No shop cards and no empty state');
      }
    }

    // 1g. CTA Banner at bottom
    const ctaBanner = page.locator('.cta-banner');
    await expect(ctaBanner).toBeVisible();
    console.log(`  CTA banner visible: ${await ctaBanner.isVisible()}`);

    // Footer
    const footer = page.locator('.footer');
    await expect(footer).toBeVisible();
    console.log(`  Footer visible: "${await footer.textContent()}"`);

    await shot(page, '01-homepage-full');

    // Test homepage language switch
    // Switch to English
    await page.locator('#btn-en').click();
    await page.waitForTimeout(500);
    const enHeroBrand = await page.locator('#hero-brand').textContent();
    console.log(`  EN hero brand: "${enHeroBrand}"`);
    expect(enHeroBrand).toContain('WhatsApp ordering');

    // Switch to Chinese
    await page.locator('#btn-zh').click();
    await page.waitForTimeout(500);
    const zhHeroBrand = await page.locator('#hero-brand').textContent();
    console.log(`  ZH hero brand: "${zhHeroBrand}"`);
    expect(zhHeroBrand).toContain('WhatsApp 点餐');

    // Switch back to NL
    await page.locator('#btn-nl').click();
    await page.waitForTimeout(500);
    const nlHeroBrand = await page.locator('#hero-brand').textContent();
    console.log(`  NL hero brand: "${nlHeroBrand}"`);
    expect(nlHeroBrand).toContain('WhatsApp bestellen');

    await shot(page, '01b-homepage-zh');

    // =====================================================================
    // STEP 2: BROWSE A SHOP
    // =====================================================================
    console.log('\n=== STEP 2: Browse Shop (/order/demo) ===');
    await page.goto(BASE + '/order/demo', { waitUntil: 'domcontentloaded', timeout: COLD_START_MS });
    await page.waitForLoadState('networkidle', { timeout: COLD_START_MS }).catch(() => {});

    // 2a. Shop header
    const shopName = page.locator('#shop-name');
    await expect(shopName).toBeVisible({ timeout: ELEM_MS });
    // Wait for spinner to be replaced with actual content
    await page.waitForTimeout(3000);
    const shopNameText = await shopName.textContent();
    console.log(`  Shop name: "${shopNameText}"`);
    // Should not still be loading
    expect(shopNameText).not.toBe('...');
    // It might say "Shop not found" if demo doesn't exist in the DB, or the actual demo name
    if (shopNameText === 'Shop not found') {
      findings.push('CRITICAL: /order/demo returns "Shop not found" - demo shop may not be seeded');
      console.log('  CRITICAL: Demo shop not found in database');
    }

    const shopDesc = page.locator('#shop-desc');
    await expect(shopDesc).toBeVisible();
    console.log(`  Shop description: "${await shopDesc.textContent()}"`);

    // 2b. Language switcher on order page
    const orderLangBtns = page.locator('.lang-switch button');
    const orderLangCount = await orderLangBtns.count();
    console.log(`  Order page language buttons: ${orderLangCount}`);
    expect(orderLangCount).toBeGreaterThanOrEqual(3);

    // 2c. Category navigation
    const catNav = page.locator('#cat-nav');
    const catVisible = await catNav.isVisible().catch(() => false);
    console.log(`  Category nav visible: ${catVisible}`);
    if (catVisible) {
      const catBtns = page.locator('#cat-nav button');
      const catBtnCount = await catBtns.count();
      console.log(`  Category buttons: ${catBtnCount}`);
      // "All" button should always exist
      const allBtn = page.locator('#cat-nav button').first();
      expect(await allBtn.textContent()).toMatch(/Alles|All|全部/);
    }

    // 2d. Menu items
    const menuEl = page.locator('#menu');
    await expect(menuEl).toBeVisible();
    // Wait for API data to load
    await page.waitForTimeout(2000);

    const items = page.locator('.item');
    const itemCount = await items.count();
    console.log(`  Menu items loaded: ${itemCount}`);

    if (itemCount === 0) {
      const emptyMenu = await page.locator('#menu').innerText();
      console.log(`  Menu content: "${emptyMenu.substring(0, 200)}"`);
      if (emptyMenu.includes('No items') || emptyMenu.includes('Geen items') || emptyMenu.includes('暂无菜品')) {
        findings.push('MEDIUM: Menu is empty for demo shop');
      } else {
        findings.push('HIGH: Menu items did not render');
      }
    }

    // Test language switch on order page
    // English
    await page.locator('#btn-en').click();
    await page.waitForTimeout(800);
    const enAllBtn = await page.locator('#cat-nav button').first().textContent();
    console.log(`  EN: All button = "${enAllBtn}"`);
    expect(enAllBtn).toContain('All');

    // Dutch
    await page.locator('#btn-nl').click();
    await page.waitForTimeout(800);
    const nlAllBtn = await page.locator('#cat-nav button').first().textContent();
    console.log(`  NL: All button = "${nlAllBtn}"`);
    expect(nlAllBtn).toContain('Alles');

    // Chinese
    await page.locator('#btn-zh').click();
    await page.waitForTimeout(800);
    const zhAllBtn = await page.locator('#cat-nav button').first().textContent();
    console.log(`  ZH: All button = "${zhAllBtn}"`);
    expect(zhAllBtn).toContain('全部');

    await shot(page, '02-order-page');

    // =====================================================================
    // STEP 3: ADD TO CART
    // =====================================================================
    console.log('\n=== STEP 3: Add to Cart ===');

    // Switch back to NL for consistency
    await page.locator('#btn-nl').click();
    await page.waitForTimeout(500);

    // 3a. Find "+" buttons
    const plusBtns = page.locator('.qty-ctrl button').filter({ hasText: '+' });
    const plusCount = await plusBtns.count();
    console.log(`  "+" buttons found: ${plusCount}`);

    if (plusCount > 0) {
      // Click "+" on first menu item
      await plusBtns.first().click();
      await page.waitForTimeout(500);

      // 3b. Check quantity updated to 1
      const qtySpan = page.locator('.qty-ctrl span').first();
      const qtyText = await qtySpan.textContent();
      console.log(`  First item quantity: "${qtyText}"`);
      expect(qtyText).toBe('1');

      // 3c. Click "+" again
      await plusBtns.first().click();
      await page.waitForTimeout(300);
      const qtyText2 = await qtySpan.textContent();
      console.log(`  First item quantity after 2nd click: "${qtyText2}"`);
      expect(qtyText2).toBe('2');

      // 3d. Cart bar updated
      const cartCount = page.locator('#cart-count');
      const cartTotal = page.locator('#cart-total');
      await expect(cartCount).toBeVisible();
      const countText = await cartCount.textContent();
      const totalText = await cartTotal.textContent();
      console.log(`  Cart: ${countText} / ${totalText}`);
      expect(countText).not.toBe('0 items');

      // 3e. Cart bounce animation
      const cartBar = page.locator('#cart-bar');
      const hasBounce = await cartBar.evaluate((el) => el.classList.contains('cart-bar--bounce'));
      console.log(`  Cart bounce class present: ${hasBounce}`);
      if (!hasBounce) {
        findings.push('LOW: Cart bounce animation class not detected (may have already completed)');
      }

      // 3f. Order button should be enabled
      const orderBtn = page.locator('#cart-btn');
      const isDisabled = await orderBtn.isDisabled();
      console.log(`  Order button disabled: ${isDisabled}`);
      expect(isDisabled).toBe(false);

      // 3g. Touch target sizes (44x44px)
      const touchTarget = page.locator('.qty-ctrl button').first();
      const box = await touchTarget.boundingBox();
      if (box) {
        console.log(`  Touch target: ${Math.round(box.width)}x${Math.round(box.height)}px`);
        if (box.width < 44 || box.height < 44) {
          findings.push(`MEDIUM: Touch target too small: ${Math.round(box.width)}x${Math.round(box.height)}px (should be >=44x44)`);
        }
      }

      // 3h. Test "-" button to decrement
      const minusBtn = page.locator('.qty-ctrl button').filter({ hasText: '−' }).first();
      await minusBtn.click();
      await page.waitForTimeout(300);
      const qtyAfterMinus = await page.locator('.qty-ctrl span').first().textContent();
      console.log(`  First item quantity after minus: "${qtyAfterMinus}"`);
      expect(qtyAfterMinus).toBe('1');

      // 3i. Test remove item (minus when qty=1)
      await minusBtn.click();
      await page.waitForTimeout(300);
      const qtyAfterRemove = await page.locator('.qty-ctrl span').first().textContent();
      console.log(`  First item quantity after 2nd minus: "${qtyAfterRemove}"`);
      expect(qtyAfterRemove).toBe('0');

      // Re-add items for checkout step
      await plusBtns.first().click();
      await page.waitForTimeout(300);

      // Also add a second item if available
      if (plusCount > 1) {
        await plusBtns.nth(1).click();
        await page.waitForTimeout(300);
      }
    } else {
      findings.push('HIGH: No "+" quantity buttons found on menu items');
    }

    await shot(page, '03-items-in-cart');

    // =====================================================================
    // STEP 4: CHECKOUT - HAPPY PATH
    // =====================================================================
    console.log('\n=== STEP 4: Checkout - Happy Path ===');

    // 4a. Open cart / checkout modal
    const cartBtn = page.locator('#cart-btn');
    await expect(cartBtn).toBeEnabled({ timeout: 5000 });
    await cartBtn.click();
    await page.waitForTimeout(500);

    // 4b. Checkout modal should be visible
    const checkoutModal = page.locator('#checkout-modal');
    await expect(checkoutModal).toBeVisible({ timeout: 5000 });
    const modalVisible = await checkoutModal.isVisible();
    console.log(`  Checkout modal visible: ${modalVisible}`);

    // 4c. Check modal elements
    const checkoutTitle = page.locator('#checkout-title');
    console.log(`  Checkout title: "${await checkoutTitle.textContent()}"`);

    // Order summary
    const orderSummary = page.locator('#order-summary');
    await expect(orderSummary).toBeVisible();
    console.log(`  Order summary visible: ${await orderSummary.isVisible()}`);

    // Payment method buttons
    const payCod = page.locator('#pay-cod');
    const payBank = page.locator('#pay-bank_transfer');
    await expect(payCod).toBeVisible();
    await expect(payBank).toBeVisible();
    console.log(`  Payment methods visible: cod=${await payCod.isVisible()} bank=${await payBank.isVisible()}`);

    // 4d. Test bank transfer shows instructions
    await payBank.click();
    await page.waitForTimeout(300);
    const bankInfo = page.locator('#bank-info');
    const bankInfoVisible = await bankInfo.isVisible().catch(() => false);
    console.log(`  Bank info visible after selecting transfer: ${bankInfoVisible}`);
    expect(bankInfoVisible).toBe(true);

    // Switch back to cash
    await payCod.click();
    await page.waitForTimeout(300);
    const bankInfoHidden = await bankInfo.isHidden().catch(() => true);
    console.log(`  Bank info hidden after switching to cash: ${bankInfoHidden}`);
    expect(bankInfoHidden).toBe(true);

    // 4e. Pickup time buttons
    const pickupBtns = page.locator('.pickup-time button');
    const pickupCount = await pickupBtns.count();
    console.log(`  Pickup time options: ${pickupCount}`);
    expect(pickupCount).toBeGreaterThanOrEqual(3);

    // 4f. Fill in customer details
    const nameInput = page.locator('#cust-name');
    const phoneInput = page.locator('#cust-phone');
    await expect(nameInput).toBeVisible();
    await expect(phoneInput).toBeVisible();

    await nameInput.fill('Arthur Test');
    // Note: phone format must match /^\+?597\d{7}$/
    await phoneInput.fill('+5971234567');

    const noteInput = page.locator('#cust-note');
    await noteInput.fill('Extra spicy please');

    // 4g. Submit order
    const submitBtn = page.locator('.submit-btn');
    await expect(submitBtn).toBeVisible();
    console.log('  Clicking submit button...');
    await submitBtn.click();

    // 4h. Wait for API response
    await page.waitForTimeout(3000);

    // 4i. Check for success view (NOT alert)
    const successView = page.locator('#success-view');
    const successVisible = await successView.isVisible().catch(() => false);
    console.log(`  Success view visible: ${successVisible}`);

    if (successVisible) {
      const successContent = await successView.innerText();
      console.log(`  Success content: "${successContent.substring(0, 300)}"`);

      // Check for success text
      const hasSuccess = successContent.includes('Gelukt') || successContent.includes('Success') || successContent.includes('下单成功');
      console.log(`  Success text found: ${hasSuccess}`);
      expect(hasSuccess).toBe(true);

      // Check for order ID
      const hasOrderId = /#\w+/.test(successContent);
      console.log(`  Order ID present: ${hasOrderId}`);
      expect(hasOrderId).toBe(true);

      // Check for WhatsApp share button
      const shareBtn = page.locator('.share-btn');
      const shareBtnVisible = await shareBtn.isVisible().catch(() => false);
      console.log(`  WhatsApp share button visible: ${shareBtnVisible}`);

      // Check for "New Order" button
      const newOrderBtn = page.locator('button:has-text("Nieuwe bestelling")');
      const newOrderVisible = await newOrderBtn.isVisible().catch(() => false);
      console.log(`  New order button visible: ${newOrderVisible}`);
    } else {
      // Check if toast appeared instead (shouldn't happen with valid data)
      const toastVisible = page.locator('.toast--visible');
      const toastCount = await toastVisible.count();
      console.log(`  Toasts visible: ${toastCount}`);
      if (toastCount > 0) {
        const toastText = await toastVisible.first().textContent();
        console.log(`  Toast message: "${toastText}"`);
        findings.push(`HIGH: Order placed but success view not shown. Toast: "${toastText}"`);
      } else {
        // Check for any error on page
        const bodyText = await page.locator('body').innerText();
        console.log(`  Body text (truncated): "${bodyText.substring(0, 500)}"`);
        findings.push('HIGH: No success view and no toast showing after order submission');
      }
    }

    await shot(page, '04-checkout-result');

    // =====================================================================
    // STEP 5: ERROR HANDLING - EMPTY FORM
    // =====================================================================
    console.log('\n=== STEP 5: Error Handling - Empty Form ===');

    // 5a. Reload the page and add an item
    await page.goto(BASE + '/order/demo', { waitUntil: 'domcontentloaded', timeout: COLD_START_MS });
    await page.waitForLoadState('networkidle', { timeout: COLD_START_MS }).catch(() => {});
    await page.waitForTimeout(3000);

    // Add item to cart
    const newPlusBtns = page.locator('.qty-ctrl button').filter({ hasText: '+' });
    const newPlusCt = await newPlusBtns.count();
    if (newPlusCt > 0) {
      await newPlusBtns.first().click();
      await page.waitForTimeout(500);
    }

    // Open checkout
    const orderBtn2 = page.locator('#cart-btn');
    await orderBtn2.waitFor({ state: 'visible', timeout: 10000 });
    const isEnabled = await orderBtn2.isEnabled().catch(() => false);
    if (isEnabled) {
      await orderBtn2.click();
      await page.waitForTimeout(500);

      // 5b. Submit with empty name
      const submitBtn2 = page.locator('.submit-btn');
      // Clear name if pre-filled
      await page.locator('#cust-name').fill('');
      await page.locator('#cust-phone').fill('');
      await submitBtn2.click();
      await page.waitForTimeout(1000);

      // 5c. Check for validation toast (NOT alert)
      const errToast = page.locator('.toast--visible');
      const errToastCount = await errToast.count();
      console.log(`  Validation toast visible: ${errToastCount}`);
      if (errToastCount > 0) {
        const errMsg = await errToast.first().textContent();
        console.log(`  Validation message: "${errMsg}"`);
        // Should be about missing name
        const hasNameErr = errMsg.includes('name') || errMsg.includes('naam') || errMsg.includes('姓名');
        console.log(`  Name error: ${hasNameErr}`);

        // Check it's using toast, not alert()
        // (We can't directly check for alert since it blocks, but if it was alert, page would be blocked)
        console.log('  Using Toast notification (no alert blocking detected)');
      } else {
        // Check if checkout modal is still showing (form validation might prevent closing)
        const stillOpen = await page.locator('#checkout-modal').isVisible().catch(() => false);
        console.log(`  Checkout still open: ${stillOpen}`);
        findings.push('MEDIUM: No validation toast appeared when submitting empty form');
      }

      // 5d. Test invalid phone format
      await page.locator('#cust-name').fill('Test');
      await page.locator('#cust-phone').fill('not-a-phone');
      await submitBtn2.click();
      await page.waitForTimeout(1000);

      const phoneToast = page.locator('.toast--visible');
      const phoneToastCount = await phoneToast.count();
      if (phoneToastCount > 0) {
        const phoneMsg = await phoneToast.first().textContent();
        console.log(`  Phone validation message: "${phoneMsg}"`);
        const hasPhoneErr = phoneMsg.includes('phone') || phoneMsg.includes('telefoon') || phoneMsg.includes('电话');
        console.log(`  Phone error: ${hasPhoneErr}`);
      } else {
        findings.push('LOW: No phone validation toast on invalid phone');
      }
    } else {
      findings.push('MEDIUM: Could not open checkout for error testing (order button disabled)');
    }

    await shot(page, '05-error-validation');

    // =====================================================================
    // FINAL REPORT
    // =====================================================================
    console.log('\n========================================');
    console.log('       E2E TEST REPORT - CUSTOMER FLOW');
    console.log('========================================');

    if (findings.length === 0) {
      console.log('  ALL CHECKS PASSED');
    } else {
      console.log('  Findings:');
      findings.forEach((f, i) => console.log(`  [${i + 1}] ${f}`));
    }

    console.log('  Screenshots saved to:', SCREENSHOT_DIR);

    // Fail on CRITICAL only
    const critical = findings.filter((f) => f.startsWith('CRITICAL'));
    expect(critical.length, `Critical issues: ${critical.join('; ')}`).toBe(0);
  });
});
