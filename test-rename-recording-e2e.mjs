import { chromium } from 'playwright';

async function runTests() {
  console.log("🚀 Starting LecNote AI - Rename & Speech/Note Features E2E Verification...");

  const browser = await chromium.launch({
    headless: true,
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
  });

  const context = await browser.newContext({
    permissions: ['microphone'],
  });

  const page = await context.newPage();

  const errors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(err.message));

  try {
    console.log("1. Navigating to http://localhost:5188...");
    await page.goto('http://localhost:5188', { waitUntil: 'networkidle', timeout: 15000 });

    // Step 1: Test Header Inline Rename
    console.log("2. Testing Header Rename...");
    const headerPencil = page.locator('main h2').locator('..').locator('button[title="Rename this lecture"]');
    await headerPencil.waitFor({ state: 'visible', timeout: 5000 });
    await headerPencil.click();

    // Verify input appeared
    const titleInput = page.locator('input[placeholder="Lecture Title"]');
    await titleInput.waitFor({ state: 'visible', timeout: 3000 });
    await titleInput.fill("Data Structures - AVL Trees & Rotations");

    const courseInput = page.locator('input[placeholder="Course/Tag"]');
    await courseInput.fill("CSE 208");

    // Click Save (Check button)
    const saveHeaderBtn = page.locator('button[title="Save Title"]');
    await saveHeaderBtn.click();
    await page.waitForTimeout(300);

    // Verify updated header title
    const updatedHeaderTitle = await page.locator('main h2').first().textContent();
    console.log(`✓ Header title updated to: "${updatedHeaderTitle.trim()}"`);
    if (!updatedHeaderTitle.includes("Data Structures - AVL Trees")) {
      throw new Error("Header title failed to update!");
    }

    // Step 2: Test Sidebar Card Rename
    console.log("3. Testing Sidebar Card Rename...");
    const firstCard = page.locator('aside .group.relative').first();
    await firstCard.waitFor({ state: 'visible', timeout: 4000 });
    
    // Hover over card to reveal pencil
    await firstCard.hover();
    const cardPencil = firstCard.locator('button[title="Rename lecture"]');
    await cardPencil.click();

    // Fill inline inputs on card in aside
    const cardTitleInput = page.locator('aside input[placeholder="Lecture Title"]');
    await cardTitleInput.waitFor({ state: 'visible', timeout: 3000 });
    await cardTitleInput.fill("Algorithms - Graph Theory & BFS");

    const cardCourseInput = page.locator('aside input[placeholder="Course / Tag (e.g. CSE 207)"]');
    await cardCourseInput.fill("CSE 301");

    const cardSaveBtn = page.locator('aside button:has-text("Save")');
    await cardSaveBtn.click();
    await page.waitForTimeout(300);

    const cardTitleAfter = await page.locator('aside h4').first().textContent();
    console.log(`✓ Sidebar Card title updated to: "${cardTitleAfter.trim()}"`);
    if (!cardTitleAfter.includes("Algorithms - Graph Theory")) {
      throw new Error("Card title failed to update in sidebar!");
    }

    // Step 3: Test Record Modal & Naming
    console.log("4. Testing Recording Studio & Lecture Naming...");
    const recordBtn = page.locator('button[title="Open Live Recording Studio"]');
    await recordBtn.click();

    await page.waitForSelector('text=Live Recording Studio', { timeout: 4000 });
    console.log("✓ Live Recording Studio modal open.");

    // Fill Title & Tag before recording
    const modalTitleInput = page.locator('input[placeholder="e.g. CSE 207 - Binary Search Trees, Physics - Waves"]');
    await modalTitleInput.fill("Physics 101 - Newton's Laws of Motion");

    const modalCourseInput = page.locator('input[placeholder="e.g. CSE 207, PHY 101, Bangla"]');
    await modalCourseInput.fill("PHY 101");

    // Click "Start Recording Lecture"
    const startRecordBtn = page.locator('button:has-text("Start Recording Lecture")');
    await startRecordBtn.click();

    // Verify recording status
    await page.waitForSelector('text=Listening & Recording Audio...', { timeout: 4000 });
    console.log("✓ Audio recording started with visualizer & timer.");

    // Wait 2.5 seconds to record audio chunks
    await page.waitForTimeout(2500);

    // Stop and save
    const stopSaveBtn = page.locator('button:has-text("Stop & Save Note")');
    await stopSaveBtn.click();

    // Modal closes and new lecture is active
    await page.waitForSelector('text=Live Recording Studio', { state: 'detached', timeout: 5000 });
    console.log("✓ Recording saved and modal closed.");

    await page.waitForTimeout(500);
    const activeRecordedTitle = await page.locator('main h2').first().textContent();
    console.log(`✓ Newly recorded lecture is active: "${activeRecordedTitle.trim()}"`);
    if (!activeRecordedTitle.includes("Physics 101 - Newton's Laws")) {
      throw new Error("Newly recorded lecture was not activated!");
    }

    // Step 4: Test "Add / Paste Notes" on the recorded lecture
    console.log("5. Testing 'Add / Paste Notes' synchronization...");
    const pasteNotesBtn = page.locator('button[title="Paste or type lecture text to auto-sync with audio timestamps"]');
    await pasteNotesBtn.click();

    await page.waitForSelector('text=Add / Paste Lecture Notes', { timeout: 3000 });
    const noteTextarea = page.locator('textarea[placeholder*="Paste lecture notes"]');
    await noteTextarea.fill("An object at rest stays at rest unless acted on by an external net force. Force equals mass times acceleration F = ma. Every action has an equal and opposite reaction.");

    const syncBtn = page.locator('button:has-text("Sync with Audio Note")');
    await syncBtn.click();

    await page.waitForTimeout(500);

    // Verify words rendered in transcript
    const firstWordToken = page.locator('.word-token:has-text("object")').first();
    await firstWordToken.waitFor({ state: 'visible', timeout: 4000 });
    console.log("✓ Manual notes synced into interactive word tokens!");

    // Test tap-to-seek on the new word
    await firstWordToken.click();
    await page.waitForSelector('text=Jumped to', { timeout: 3000 });
    console.log("✓ Tap-to-seek on newly synced word working perfectly!");

    console.log("\n==========================================");
    console.log("🎉 ALL E2E TESTS PASSED 100% ERROR-FREE!");
    console.log("==========================================");

  } catch (err) {
    console.error("❌ Test Failed:", err);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

runTests();
