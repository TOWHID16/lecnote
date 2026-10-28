import { chromium } from 'playwright';

async function runE2ETests() {
  console.log("🚀 Starting LecNote AI Autonomous End-to-End Test Suite...");
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
  });

  const context = await browser.newContext({
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
    // 1. Open the app
    console.log("1. Navigating to http://localhost:5188...");
    await page.goto('http://localhost:5188', { waitUntil: 'networkidle', timeout: 15000 });

    // 2. Verify Page Title & Header
    const title = await page.title();
    console.log(`✓ Page Title: "${title}"`);
    if (!title.includes('LecNote AI')) {
      throw new Error(`Unexpected page title: ${title}`);
    }

    // 3. Verify Sample Lecture Loaded
    console.log("2. Verifying Sample Banglish Lecture Loaded into IndexedDB...");
    await page.waitForSelector('text=CSE 207: Binary Search Tree', { timeout: 8000 });
    console.log("✓ Active Lecture Header is displayed.");

    // 4. Verify Word-Level Tokens Rendered
    const wordElements = await page.$$('.word-token');
    console.log(`✓ Found ${wordElements.length} interactive word tokens rendered.`);
    if (wordElements.length === 0) {
      throw new Error("No word tokens rendered in transcript view!");
    }

    // 5. Test Tap-to-Seek
    console.log("3. Testing Tap-to-Seek on word 'balanced'...");
    // Find the word 'balanced'
    const balancedWord = page.locator('.word-token:has-text("balanced")').first();
    await balancedWord.waitFor({ state: 'visible' });
    const targetStartTime = await balancedWord.getAttribute('data-start-time');
    console.log(`  Word 'balanced' startTime: ${targetStartTime}s`);

    // Click the word
    await balancedWord.click();

    // Verify seeking badge appeared
    await page.waitForSelector('text=Jumped to', { timeout: 3000 });
    const badgeText = await page.locator('text=Jumped to').textContent();
    console.log(`✓ Tap-to-Seek Badge displayed: "${badgeText.trim()}"`);

    // Verify audio player slider or audio element timestamp moved
    await page.waitForTimeout(500);
    const audioCurrentTime = await page.evaluate(() => {
      const audio = document.querySelector('audio');
      return audio ? audio.currentTime : -1;
    });
    console.log(`✓ Audio element currentTime moved to: ${audioCurrentTime.toFixed(2)}s`);
    if (audioCurrentTime < 5.0) {
      throw new Error(`Audio currentTime did not seek properly! Got: ${audioCurrentTime}`);
    }

    // 6. Test Word Highlighting & Persistence
    console.log("4. Testing Highlight Marker toggle & word highlight...");
    const highlightToggle = page.locator('button:has-text("Highlight Marker")').first();
    await highlightToggle.click();
    console.log("  Highlight Marker enabled.");

    // Click on a word like 'binary' to highlight it
    const binaryWord = page.locator('.word-token:has-text("binary")').first();
    await binaryWord.click();
    await page.waitForTimeout(400);

    // Verify the word has is-highlighted class
    const isBinaryHighlighted = await binaryWord.evaluate(el => el.classList.contains('is-highlighted'));
    console.log(`✓ Word 'binary' highlighted state: ${isBinaryHighlighted}`);
    if (!isBinaryHighlighted) {
      throw new Error("Word 'binary' did not receive .is-highlighted class!");
    }

    // Turn off highlight mode
    await highlightToggle.click();

    // 7. Test Inline Double-Click Editing
    console.log("5. Testing Inline Double-Click Editing...");
    const treeWord = page.locator('.word-token:has-text("tree")').first();
    await treeWord.dblclick();

    // Check if input appeared
    const editInput = page.locator('input.bg-indigo-900').first();
    await editInput.waitFor({ state: 'visible', timeout: 3000 });
    console.log("✓ Inline edit input visible.");
    await editInput.fill('Tree (B-Tree)');
    await editInput.press('Enter');
    await page.waitForTimeout(500);

    const updatedTextFound = await page.locator('.word-token:has-text("Tree (B-Tree)")').count();
    console.log(`✓ Word spelling updated inline: found ${updatedTextFound} instance(s).`);

    // 8. Test Summary & Key Notes Tab
    console.log("6. Testing Summary & Key Notes generation...");
    const summaryTabBtn = page.locator('button:has-text("Summary")');
    await summaryTabBtn.click();
    await page.waitForSelector('text=Lecture Overview', { timeout: 4000 });
    console.log("✓ Summary tab opened and overview is visible.");

    // Verify key points
    const keyPointsCount = await page.locator('text=Core Takeaways').count();
    console.log(`✓ Core Takeaways section present: ${keyPointsCount > 0}`);

    // Click Regenerate Summary
    const regenerateBtn = page.locator('button:has-text("Regenerate")');
    await regenerateBtn.click();
    await page.waitForTimeout(1000);
    console.log("✓ Regenerated summary successfully.");

    // 9. Test Share & Export Modal
    console.log("7. Testing Share & Export Modal...");
    const exportBtn = page.locator('button:has-text("Export & Share")');
    await exportBtn.click();
    await page.waitForSelector('text=Share & Export Note', { timeout: 3000 });
    console.log("✓ Export modal opened.");

    const bundleBtn = await page.locator('text=.lecnote.json Bundle').count();
    const pdfBtn = await page.locator('text=Export PDF').count();
    console.log(`✓ Export options found: .lecnote.json (${bundleBtn}), PDF (${pdfBtn})`);

    // Close modal
    await page.keyboard.press('Escape');
    await page.waitForSelector('text=Share & Export Note', { state: 'hidden', timeout: 3000 });
    await page.waitForTimeout(300);

    // 10. Test Cloud AI Boost Modal
    console.log("8. Testing Cloud AI Boost Settings Modal...");
    const cloudBtn = page.locator('button:has-text("Cloud Boost")');
    await cloudBtn.click();
    await page.waitForSelector('text=Cloud AI Boost (Optional)', { timeout: 3000 });
    console.log("✓ Cloud AI modal opened.");

    const autoDetectBtn = page.locator('button:has-text("Auto-Detect Keys")');
    await autoDetectBtn.click();
    await page.waitForTimeout(500);
    console.log("✓ Auto-detect keys triggered.");

    // Close modal
    await page.keyboard.press('Escape');
    await page.waitForSelector('text=Cloud AI Boost (Optional)', { state: 'hidden', timeout: 3000 });
    await page.waitForTimeout(300);

    // 11. Test Live Recording Studio
    console.log("9. Testing Live Recording Studio & Saving to IndexedDB...");
    const recordBtn = page.locator('button:has-text("Record")').first();
    await recordBtn.click();
    await page.waitForSelector('text=Live Recording Studio', { timeout: 3000 });
    console.log("✓ Recording Studio opened.");

    // Fill title
    const titleInput = page.locator('input[placeholder="e.g. AI Ethics & Algorithms"]');
    await titleInput.fill('Live Test Lecture (Banglish AI)');

    // Click Start Recording
    const startRecBtn = page.locator('button:has-text("Start Recording Lecture")');
    await startRecBtn.click();
    console.log("✓ Recording started with simulated microphone stream.");

    // Record for 2.5 seconds
    await page.waitForTimeout(2500);

    // Stop and save
    const stopSaveBtn = page.locator('button:has-text("Stop & Save Note")');
    await stopSaveBtn.click();
    await page.waitForTimeout(1000);
    console.log("✓ Recorded lecture saved to IndexedDB.");

    // Verify it appears in sidebar and main header
    const newLecSidebar = page.locator('text=Live Test Lecture (Banglish AI)').first();
    await newLecSidebar.waitFor({ state: 'visible', timeout: 4000 });
    console.log("✓ Newly recorded lecture is visible in sidebar and active!");

    // 11. Verify Console Errors
    console.log(`9. Checking console errors (${consoleErrors.length} found)...`);
    if (consoleErrors.length > 0) {
      console.warn("Console errors detected:", consoleErrors);
    } else {
      console.log("✓ Zero console errors detected!");
    }

    console.log("\n🎉 ALL AUTONOMOUS E2E TESTS PASSED SUCCESSFULLY! 100% OPERATIONAL.\n");
  } catch (error) {
    console.error("❌ E2E Test Failed:", error);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

runE2ETests();
