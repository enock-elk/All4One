const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const SCREENSHOTS_DIR = '/tmp/all4one_test_screenshots';

// Create screenshots directory
if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTests() {
  console.log('Starting All4One Command Center tests on port 5502...\n');
  
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: { width: 1920, height: 1080 },
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu'
    ]
  });

  const page = await browser.newPage();
  
  try {
    // ============================================
    // A. Brand-new user + Affidavit deep link
    // ============================================
    console.log('=== TEST A: Brand-new user + Affidavit deep link ===\n');
    
    // Step 1: Open root and clear storage
    console.log('Step 1: Opening http://127.0.0.1:5502/ and clearing storage...');
    await page.goto('http://127.0.0.1:5502/', { waitUntil: 'networkidle2' });
    
    await page.evaluate(() => {
      localStorage.removeItem('all4one_default_tab');
      sessionStorage.clear();
    });
    console.log('✓ Storage cleared\n');
    
    // Step 2: Navigate to AffidavitAutomation and hard refresh
    console.log('Step 2: Navigating to /AffidavitAutomation...');
    await page.goto('http://127.0.0.1:5502/AffidavitAutomation', { waitUntil: 'domcontentloaded' });
    
    // Watch for loading panel
    console.log('Watching for loading panel...');
    await sleep(100); // Brief delay to catch loader
    
    const hasLoader = await page.evaluate(() => {
      const loaderText = document.body.innerText;
      return loaderText.includes('LOADING') || loaderText.includes('Loading');
    });
    
    if (hasLoader) {
      console.log('✓ Loading panel detected!');
      await page.screenshot({ 
        path: path.join(SCREENSHOTS_DIR, 'a3_affidavit_loader.png'),
        fullPage: false 
      });
    } else {
      console.log('⚠ Loading panel not visible (loaded too fast)');
    }
    
    // Wait for page to fully load
    await sleep(2000); // Give page time to load
    
    // Step 4: Verify Affidavit is active and pinned
    console.log('\nStep 4: Verifying Affidavit Automation is active and pinned...');
    const currentUrl = page.url();
    const headerText = await page.$eval('header', el => el.innerText).catch(() => '');
    
    // Check if pinned (look for pin icon or pinned class)
    const isPinned = await page.evaluate(() => {
      const affidavitItem = document.querySelector('[class*="Affidavit"]');
      if (!affidavitItem) return false;
      
      // Check for pin icon (📌 or star or similar)
      const hasPinIcon = affidavitItem.innerHTML.includes('📌') || 
                         affidavitItem.querySelector('[class*="pin"]') !== null ||
                         affidavitItem.querySelector('[class*="Pin"]') !== null;
      
      // Check if it's first in the list
      const sidebar = document.querySelector('.sidebar') || document.querySelector('[class*="sidebar"]');
      if (!sidebar) return hasPinIcon;
      
      const items = sidebar.querySelectorAll('[class*="item"]');
      const isFirst = items.length > 0 && items[0] === affidavitItem;
      
      return hasPinIcon || isFirst;
    });
    
    console.log(`  URL: ${currentUrl}`);
    console.log(`  Header: ${headerText}`);
    console.log(`  Is Pinned: ${isPinned}`);
    
    // Step 5: Screenshot
    await page.screenshot({ 
      path: path.join(SCREENSHOTS_DIR, 'a5_affidavit_pinned.png'),
      fullPage: false 
    });
    console.log('✓ Screenshot saved: a5_affidavit_pinned.png\n');
    
    const testA = {
      pass: currentUrl.includes('/AffidavitAutomation') && isPinned,
      url: currentUrl,
      pinned: isPinned,
      hasLoader: hasLoader
    };
    
    // ============================================
    // B. Navigate tabs — URL updates, pin stays
    // ============================================
    console.log('=== TEST B: Navigate tabs — URL updates, pin stays ===\n');
    
    // Step 6: Click Trello Watcher
    console.log('Step 6: Clicking Trello Watcher...');
    await page.click('text=Trello Watcher').catch(async () => {
      // Try alternative selector
      await page.evaluate(() => {
        const trelloLink = [...document.querySelectorAll('*')].find(el => 
          el.textContent.includes('Trello Watcher')
        );
        if (trelloLink) trelloLink.click();
      });
    });
    await sleep(500);
    
    const trelloUrl = page.url();
    const affidavitStillPinned1 = await page.evaluate(() => {
      const affidavitItem = document.querySelector('[class*="Affidavit"]');
      return affidavitItem && (
        affidavitItem.innerHTML.includes('📌') || 
        affidavitItem.querySelector('[class*="pin"]') !== null
      );
    });
    
    console.log(`  URL: ${trelloUrl}`);
    console.log(`  Affidavit still pinned: ${affidavitStillPinned1}`);
    
    // Step 7: Click Case Maker
    console.log('\nStep 7: Clicking Case Maker...');
    await page.click('text=Case Maker').catch(async () => {
      await page.evaluate(() => {
        const caseMakerLink = [...document.querySelectorAll('*')].find(el => 
          el.textContent.includes('Case Maker')
        );
        if (caseMakerLink) caseMakerLink.click();
      });
    });
    
    // Watch for Case Maker loader
    await sleep(100);
    const hasCaseMakerLoader = await page.evaluate(() => {
      const bodyText = document.body.innerText;
      return bodyText.includes('LOADING') || bodyText.includes('Case Maker') && bodyText.includes('%');
    });
    
    if (hasCaseMakerLoader) {
      console.log('✓ Case Maker loading panel detected!');
      await page.screenshot({ 
        path: path.join(SCREENSHOTS_DIR, 'b7_casemaker_loader.png'),
        fullPage: false 
      });
    }
    
    await sleep(1000); // Wait for Case Maker to load
    const caseMakerUrl = page.url();
    console.log(`  URL: ${caseMakerUrl}`);
    
    // Step 8: Click Document Manager
    console.log('\nStep 8: Clicking Document Manager...');
    await page.click('text=Document Manager').catch(async () => {
      await page.evaluate(() => {
        const docMgrLink = [...document.querySelectorAll('*')].find(el => 
          el.textContent.includes('Document Manager')
        );
        if (docMgrLink) docMgrLink.click();
      });
    });
    await sleep(500);
    
    const docMgrUrl = page.url();
    const affidavitStillPinned2 = await page.evaluate(() => {
      const affidavitItem = document.querySelector('[class*="Affidavit"]');
      return affidavitItem && (
        affidavitItem.innerHTML.includes('📌') || 
        affidavitItem.querySelector('[class*="pin"]') !== null
      );
    });
    
    console.log(`  URL: ${docMgrUrl}`);
    console.log(`  Affidavit still pinned: ${affidavitStillPinned2}\n`);
    
    const testB = {
      pass: trelloUrl.includes('/TrelloWatcher') && 
            caseMakerUrl.includes('/CaseMaker') && 
            docMgrUrl.includes('/DocumentManager') &&
            affidavitStillPinned1 && affidavitStillPinned2,
      trelloUrl,
      caseMakerUrl,
      docMgrUrl,
      pinStayed: affidavitStillPinned1 && affidavitStillPinned2,
      hasCaseMakerLoader
    };
    
    // ============================================
    // C. Existing pin must NOT steal a deep link
    // ============================================
    console.log('=== TEST C: Existing pin must NOT steal a deep link ===\n');
    
    // Step 9: Visit TrelloWatcher with hard refresh
    console.log('Step 9: Navigating to /TrelloWatcher with hard refresh...');
    await page.goto('http://127.0.0.1:5502/TrelloWatcher', { 
      waitUntil: 'networkidle2' 
    });
    await sleep(500);
    
    // Step 10-11: Verify we landed on Trello and Affidavit is still pinned
    const finalUrl = page.url();
    const finalHeader = await page.$eval('header', el => el.innerText).catch(() => '');
    const trelloActive = await page.evaluate(() => {
      return document.body.innerText.includes('TrelloWatcher') || 
             document.body.innerText.includes('Trello Watcher');
    });
    const affidavitStillPinnedFinal = await page.evaluate(() => {
      const affidavitItem = document.querySelector('[class*="Affidavit"]');
      return affidavitItem && (
        affidavitItem.innerHTML.includes('📌') || 
        affidavitItem.querySelector('[class*="pin"]') !== null
      );
    });
    
    console.log(`  URL: ${finalUrl}`);
    console.log(`  Header: ${finalHeader}`);
    console.log(`  Trello Watcher active: ${trelloActive}`);
    console.log(`  Affidavit still pinned: ${affidavitStillPinnedFinal}`);
    
    // Step 12: Screenshot
    await page.screenshot({ 
      path: path.join(SCREENSHOTS_DIR, 'c12_trello_with_affidavit_pin.png'),
      fullPage: false 
    });
    console.log('✓ Screenshot saved: c12_trello_with_affidavit_pin.png\n');
    
    const redirectedToAffidavit = finalUrl.includes('/AffidavitAutomation');
    const testC = {
      pass: finalUrl.includes('/TrelloWatcher') && 
            trelloActive && 
            affidavitStillPinnedFinal &&
            !redirectedToAffidavit,
      url: finalUrl,
      trelloActive,
      affidavitPinned: affidavitStillPinnedFinal,
      redirectedToAffidavit
    };
    
    // ============================================
    // SUMMARY
    // ============================================
    console.log('\n========================================');
    console.log('TEST SUMMARY');
    console.log('========================================\n');
    
    console.log(`TEST A (Brand-new user + Affidavit deep link): ${testA.pass ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`  - Affidavit URL correct: ${testA.url.includes('/AffidavitAutomation') ? '✅' : '❌'}`);
    console.log(`  - Affidavit pinned: ${testA.pinned ? '✅' : '❌'}`);
    console.log(`  - Loader visible: ${testA.hasLoader ? '✅' : '⚠️ Too fast'}`);
    console.log(`  - Screenshot: ${path.join(SCREENSHOTS_DIR, 'a5_affidavit_pinned.png')}\n`);
    
    console.log(`TEST B (Navigate tabs — URL updates, pin stays): ${testB.pass ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`  - Trello URL: ${testB.trelloUrl.includes('/TrelloWatcher') ? '✅' : '❌'} ${testB.trelloUrl}`);
    console.log(`  - Case Maker URL: ${testB.caseMakerUrl.includes('/CaseMaker') ? '✅' : '❌'} ${testB.caseMakerUrl}`);
    console.log(`  - Doc Manager URL: ${testB.docMgrUrl.includes('/DocumentManager') ? '✅' : '❌'} ${testB.docMgrUrl}`);
    console.log(`  - Pin stayed: ${testB.pinStayed ? '✅' : '❌'}`);
    console.log(`  - Case Maker loader: ${testB.hasCaseMakerLoader ? '✅' : '⚠️ Too fast'}\n`);
    
    console.log(`TEST C (Existing pin must NOT steal deep link): ${testC.pass ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`  - Final URL: ${testC.url}`);
    console.log(`  - Landed on Trello: ${testC.trelloActive ? '✅' : '❌'}`);
    console.log(`  - Affidavit still pinned: ${testC.affidavitPinned ? '✅' : '❌'}`);
    console.log(`  - NOT redirected to Affidavit: ${!testC.redirectedToAffidavit ? '✅' : '❌ FAILED - Got redirected!'}`);
    console.log(`  - Screenshot: ${path.join(SCREENSHOTS_DIR, 'c12_trello_with_affidavit_pin.png')}\n`);
    
    const allPass = testA.pass && testB.pass && testC.pass;
    console.log(`\n${'='.repeat(40)}`);
    console.log(`OVERALL: ${allPass ? '✅ ALL TESTS PASS' : '❌ SOME TESTS FAILED'}`);
    console.log(`${'='.repeat(40)}\n`);
    
    console.log(`Screenshots saved to: ${SCREENSHOTS_DIR}/`);
    
  } catch (error) {
    console.error('Error during testing:', error);
  } finally {
    // Keep browser open for 5 seconds to allow viewing
    console.log('\nKeeping browser open for 5 seconds...');
    await sleep(5000);
    await browser.close();
  }
}

runTests().catch(console.error);
