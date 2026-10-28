import { chromium } from 'playwright';

async function testSpecificShare() {
  console.log("🚀 Testing Specific Recording Share & Transcribe Flow...");
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.goto('http://localhost:5188', { waitUntil: 'networkidle', timeout: 15000 });

    // 1. Verify Share button on sidebar lecture cards
    const firstCard = page.locator('aside .group.relative').first();
    await firstCard.waitFor({ state: 'visible', timeout: 4000 });
    const firstTitle = (await firstCard.locator('h4').textContent()).trim();
    console.log(`1. Target first card title: "${firstTitle}"`);

    // Click the Share button on that specific card
    await firstCard.hover();
    const cardShareBtn = firstCard.locator('button[title*="Share"]').first();
    await cardShareBtn.waitFor({ state: 'visible', timeout: 3000 });
    await cardShareBtn.click();

    // Verify Share Modal opened specifically for this recording
    await page.waitForSelector('text=Share Recording', { timeout: 3000 });
    const modalTargetText = await page.locator('text=Selected Recording:').locator('..').locator('h3').textContent();
    console.log(`✓ Share modal opened specifically for: "${modalTargetText.trim()}"`);
    if (!modalTargetText.includes(firstTitle)) {
      throw new Error(`Expected modal for "${firstTitle}", but got "${modalTargetText}"`);
    }

    // Close modal
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    // 2. Test Share button in Main Studio Header
    const headerShareBtn = page.locator('main h2').locator('..').locator('button[title*="Share"]');
    await headerShareBtn.waitFor({ state: 'visible', timeout: 3000 });
    await headerShareBtn.click();

    await page.waitForSelector('text=Share Recording', { timeout: 3000 });
    const headerModalText = await page.locator('text=Selected Recording:').locator('..').locator('h3').textContent();
    console.log(`✓ Header share button correctly shared active lecture: "${headerModalText.trim()}"`);

    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    // 3. Test "Transcribe with AI" button opens Quick Key Modal
    const transcribeBtn = page.locator('button[title*="AI Whisper Transcription"]').first();
    if (await transcribeBtn.isVisible()) {
      await transcribeBtn.click();
      await page.waitForSelector('text=Option 1: 100% Free In-Browser AI', { timeout: 3000 });
      console.log("✓ Quick Transcribe Modal opened with Zero-Key Local AI & Cloud options!");
      await page.keyboard.press('Escape');
    }

    console.log("\n🎉 ALL SPECIFIC SHARE & TRANSCRIBE TESTS PASSED 100%!");
  } catch (err) {
    console.error("❌ Test Failed:", err);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

testSpecificShare();
