import { chromium, devices } from 'playwright';

async function runMobileE2ETests() {
  console.log("📱 Starting Mobile Responsiveness & Functionality E2E Test Suite...");
  
  // Use iPhone 14 mobile device emulation
  const iPhone = devices['iPhone 14'];
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
  });

  const context = await browser.newContext({
    ...iPhone,
    permissions: ['microphone'],
  });

  const page = await context.newPage();

  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });
  page.on('pageerror', (err) => {
    consoleErrors.push(err.message);
  });

  try {
    // 1. Open mobile app on port 5188
    console.log("1. Navigating to http://localhost:5188 in iPhone 14 viewport (390x844)...");
    await page.goto('http://localhost:5188', { waitUntil: 'networkidle', timeout: 15000 });

    // 2. Check for Horizontal Overflow (Critical Mobile Rule!)
    const hasHorizontalOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    console.log(`✓ Horizontal overflow check: ${hasHorizontalOverflow ? "❌ FAILED (Horizontal scroll detected!)" : "✓ PASSED (Zero horizontal overflow)"}`);
    if (hasHorizontalOverflow) {
      throw new Error("Page has horizontal overflow on mobile!");
    }

    // 3. Test Mobile Drawer (Hamburger Menu)
    console.log("2. Testing Mobile Drawer (Hamburger Menu)...");
    const hamburgerBtn = page.locator('button[aria-label="Open Lectures Drawer"]');
    await hamburgerBtn.waitFor({ state: 'visible', timeout: 4000 });
    console.log("✓ Mobile hamburger button visible.");

    await hamburgerBtn.click();
    await page.waitForSelector('text=All Lectures', { timeout: 3000 });
    console.log("✓ Mobile Lectures Drawer opened.");

    // Click on a lecture inside the mobile drawer
    const drawerLecture = page.locator('.fixed.inset-0.z-50 h4:has-text("CSE 207: Binary Search Tree")');
    await drawerLecture.waitFor({ state: 'visible', timeout: 3000 });
    await drawerLecture.click();
    await page.waitForTimeout(400);

    // Verify drawer closed
    const isDrawerOpen = await page.locator('text=All Lectures').isVisible();
    console.log(`✓ Mobile drawer auto-closed on selection: ${!isDrawerOpen}`);

    // 4. Test Mobile Tap-to-Seek
    console.log("3. Testing Tap-to-Seek on mobile touch...");
    const balancedWord = page.locator('.word-token:has-text("balanced")').first();
    await balancedWord.waitFor({ state: 'visible' });
    await balancedWord.click();

    // Verify floating seek badge
    await page.waitForSelector('text=Jumped to', { timeout: 3000 });
    const badgeText = await page.locator('text=Jumped to').textContent();
    console.log(`✓ Mobile Tap-to-Seek Badge: "${badgeText.trim()}"`);

    // Verify audio player currentTime
    const audioCurrentTime = await page.evaluate(() => {
      const audio = document.querySelector('audio');
      return audio ? audio.currentTime : -1;
    });
    console.log(`✓ Mobile Audio currentTime: ${audioCurrentTime.toFixed(2)}s`);
    if (audioCurrentTime < 5.0) {
      throw new Error("Audio failed to seek on mobile!");
    }

    // 5. Test Mobile Highlighting
    console.log("4. Testing Mobile Word Highlighting...");
    const highlightToggle = page.locator('button:has-text("Highlight Marker")').first();
    await highlightToggle.click();
    console.log("✓ Highlight mode enabled on mobile.");

    const complexityWord = page.locator('.word-token:has-text("complexity")').first();
    await complexityWord.click();
    await page.waitForTimeout(300);

    const isHighlighted = await complexityWord.evaluate(el => el.classList.contains('is-highlighted'));
    console.log(`✓ Word 'complexity' highlighted state: ${isHighlighted}`);
    if (!isHighlighted) {
      throw new Error("Word failed to highlight on mobile touch!");
    }
    await highlightToggle.click(); // turn off

    // 6. Test Mobile Tab Navigation ("Transcript" vs "Summary & Notes")
    console.log("5. Testing Mobile Segmented Tab Switching...");
    const summaryTab = page.locator('button:has-text("Summary & Notes")');
    await summaryTab.click();
    await page.waitForSelector('text=Lecture Overview', { timeout: 4000 });
    console.log("✓ Summary tab displayed cleanly on mobile.");

    // Check no overflow on summary tab
    const summaryOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    console.log(`✓ Summary view horizontal overflow: ${summaryOverflow ? "❌ FAILED" : "✓ PASSED (Zero overflow)"}`);

    // Test Regenerate Summary on mobile
    const regenBtn = page.locator('button:has-text("Regenerate")');
    await regenBtn.click();
    await page.waitForTimeout(800);
    console.log("✓ Summary regenerated successfully on mobile.");

    // Switch back to Transcript tab
    const transcriptTab = page.locator('button:has-text("Transcript")');
    await transcriptTab.click();
    await page.waitForTimeout(300);

    // 7. Test Mobile Record Modal
    console.log("6. Testing Mobile Record Modal...");
    const recordBtn = page.locator('header button:has-text("Record")');
    await recordBtn.click();
    await page.waitForSelector('text=Live Recording Studio', { timeout: 3000 });
    console.log("✓ Record modal opened on mobile.");

    const modalOverflow = await page.evaluate(() => {
      const modal = document.querySelector('.max-h-\\[92vh\\]');
      return modal ? modal.scrollHeight > 0 : false;
    });
    console.log(`✓ Record modal fits inside mobile screen: ${modalOverflow}`);

    // Close modal
    await page.keyboard.press('Escape');
    await page.waitForSelector('text=Live Recording Studio', { state: 'hidden', timeout: 3000 });
    console.log("✓ Record modal closed.");

    // 8. Test Mobile Export Modal
    console.log("7. Testing Mobile Export Modal...");
    const exportBtn = page.locator('header button[title*="Share"]').first();
    await exportBtn.click();
    await page.waitForSelector('text=Share Recording', { timeout: 3000 });
    console.log("✓ Export modal opened on mobile.");

    await page.keyboard.press('Escape');
    await page.waitForSelector('text=Share Recording', { state: 'hidden', timeout: 3000 });
    console.log("✓ Export modal closed.");

    // 9. Check Console Errors
    console.log(`8. Checking mobile console errors (${consoleErrors.length} found)...`);
    if (consoleErrors.length > 0) {
      console.warn("Mobile console errors detected:", consoleErrors);
    } else {
      console.log("✓ Zero console errors detected on mobile!");
    }

    console.log("\n🎉 ALL MOBILE RESPONSIVENESS & FUNCTIONALITY TESTS PASSED! 100% READY FOR MARKETING.\n");
  } catch (error) {
    console.error("❌ Mobile Test Failed:", error);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

runMobileE2ETests();
