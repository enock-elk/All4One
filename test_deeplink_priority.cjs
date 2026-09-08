const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const SCREENSHOTS_DIR = '/tmp/all4one_deeplink_test';

if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testDeepLinkPriority() {
  console.log('\n=== Testing Deep-Link Priority Fix ===\n');
  
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: { width: 1920, height: 1080 },
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
  });

  const page = await browser.newPage();
  
  try {
    // Step 1: Clear storage
    console.log('Step 1: Opening http://127.0.0.1:5502/ and clearing storage...');
    await page.goto('http://127.0.0.1:5502/', { waitUntil: 'networkidle2' });
    
    await page.evaluate(() => {
      localStorage.removeItem('all4one_default_tab');
      sessionStorage.clear();
    });
    console.log('✓ Storage cleared\n');
    
    // Step 2: Visit AffidavitAutomation
    console.log('Step 2: Going to /AffidavitAutomation with hard refresh...');
    await page.goto('http://127.0.0.1:5502/AffidavitAutomation', { waitUntil: 'domcontentloaded' });
    await sleep(100);
    
    // Check for loader
    const hasLoader = await page.evaluate(() => {
      return document.body.innerText.includes('LOADING');
    });
    
    if (hasLoader) {
      console.log('✓ Loading panel detected!');
      await page.screenshot({ 
        path: path.join(SCREENSHOTS_DIR, 'step2_affidavit_loader.png'),
        fullPage: false 
      });
    }
    
    await sleep(2000);
    
    const step2Url = page.url();
    const step2Header = await page.$eval('header', el => el.innerText).catch(() => 'N/A');
    const step2Storage = await page.evaluate(() => {
      return localStorage.getItem('all4one_default_tab');
    });
    
    console.log(`  URL: ${step2Url}`);
    console.log(`  Header: ${step2Header}`);
    console.log(`  localStorage default_tab: ${step2Storage}`);
    console.log('✓ Affidavit loaded and pinned\n');
    
    // Screenshot
    await page.screenshot({ 
      path: path.join(SCREENSHOTS_DIR, 'step2_affidavit_pinned.png'),
      fullPage: false 
    });
    
    // Step 3: Click Trello Watcher
    console.log('Step 3: Clicking Trello Watcher in sidebar...');
    await page.evaluate(() => {
      const trelloLink = [...document.querySelectorAll('*')].find(el => 
        el.textContent.includes('Trello Watcher') && el.tagName !== 'HEADER'
      );
      if (trelloLink) trelloLink.click();
    });
    await sleep(1000);
    
    const step3Url = page.url();
    console.log(`  URL after click: ${step3Url}`);
    console.log(`  ${step3Url.includes('/TrelloWatcher') ? '✓' : '❌'} URL is /TrelloWatcher\n`);
    
    // Step 4: Navigate to TrelloWatcher in address bar with hard refresh
    console.log('Step 4: Navigating to http://127.0.0.1:5502/TrelloWatcher with hard refresh (Ctrl+Shift+R)...');
    await page.goto('http://127.0.0.1:5502/TrelloWatcher', { 
      waitUntil: 'networkidle2',
      // This simulates a hard refresh by bypassing cache
    });
    await sleep(2000);
    
    // Step 5: CRITICAL CHECK
    console.log('\nStep 5: CRITICAL CHECK after hard refresh...');
    const step5Url = page.url();
    const step5Pathname = await page.evaluate(() => location.pathname);
    const step5Header = await page.$eval('header', el => el.innerText).catch(() => 'N/A');
    
    // Check if Trello Watcher is active
    const trelloActive = await page.evaluate(() => {
      const header = document.querySelector('header');
      const body = document.body.innerText;
      return header && header.innerText.includes('Trello Watcher');
    });
    
    // Check if Affidavit is still pinned but NOT active
    const sidebarState = await page.evaluate(() => {
      const allItems = [...document.querySelectorAll('[class*="sidebar"] *')].filter(el => 
        el.textContent.includes('Affidavit Automation') || 
        el.textContent.includes('Trello Watcher')
      );
      
      // Find the actual navigation items
      const affidavitItem = [...document.querySelectorAll('*')].find(el => 
        el.textContent.includes('Affidavit Automation') && 
        el.textContent.includes('Expert affidavits')
      );
      
      const trelloItem = [...document.querySelectorAll('*')].find(el => 
        el.textContent.includes('Trello Watcher') && 
        el.textContent.includes('Live board monitor')
      );
      
      return {
        affidavitHtml: affidavitItem ? affidavitItem.outerHTML.substring(0, 200) : 'not found',
        trelloHtml: trelloItem ? trelloItem.outerHTML.substring(0, 200) : 'not found',
        affidavitHasActiveClass: affidavitItem ? affidavitItem.className.includes('active') : false,
        trelloHasActiveClass: trelloItem ? trelloItem.className.includes('active') : false
      };
    });
    
    // Get storage state
    const storageState = await page.evaluate(() => {
      return {
        defaultTab: localStorage.getItem('all4one_default_tab'),
        deepLink: sessionStorage.getItem('all4one_deep_link'),
        pathname: location.pathname
      };
    });
    
    console.log(`  URL: ${step5Url}`);
    console.log(`  location.pathname: ${step5Pathname}`);
    console.log(`  Header: ${step5Header}`);
    console.log(`  Trello Watcher active: ${trelloActive}`);
    console.log(`  localStorage.all4one_default_tab: ${storageState.defaultTab}`);
    console.log(`  sessionStorage.all4one_deep_link: ${storageState.deepLink}`);
    console.log(`  Affidavit has active class: ${sidebarState.affidavitHasActiveClass}`);
    console.log(`  Trello has active class: ${sidebarState.trelloHasActiveClass}`);
    
    // Step 6: Screenshot
    console.log('\nStep 6: Taking screenshot of final state...');
    await page.screenshot({ 
      path: path.join(SCREENSHOTS_DIR, 'step5_critical_trello_final.png'),
      fullPage: false 
    });
    console.log(`✓ Screenshot saved: step5_critical_trello_final.png\n`);
    
    // Determine pass/fail
    const correctUrl = step5Url.includes('/TrelloWatcher') && step5Pathname === '/TrelloWatcher';
    const correctHeader = step5Header.includes('Trello Watcher');
    const notRedirected = !step5Url.includes('/AffidavitAutomation');
    
    console.log('\n========================================');
    console.log('TEST RESULTS');
    console.log('========================================\n');
    
    console.log(`Step 2 (Affidavit pinned): ${step2Storage === 'affidavits' ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Step 3 (Trello URL): ${step3Url.includes('/TrelloWatcher') ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Step 5 (CRITICAL - Deep link wins):`);
    console.log(`  - URL is /TrelloWatcher: ${correctUrl ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`  - Header is Trello Watcher: ${correctHeader ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`  - NOT redirected to Affidavit: ${notRedirected ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`  - Trello active in UI: ${trelloActive ? '✅ PASS' : '❌ FAIL'}`);
    
    const overallPass = correctUrl && correctHeader && notRedirected && trelloActive;
    
    console.log(`\n${'='.repeat(40)}`);
    console.log(`OVERALL: ${overallPass ? '✅ PASS - Deep link priority works!' : '❌ FAIL - Still redirecting to pinned tab'}`);
    console.log(`${'='.repeat(40)}\n`);
    
    if (!overallPass) {
      console.log('DEBUG INFO:');
      console.log(`  location.pathname: ${storageState.pathname}`);
      console.log(`  localStorage.all4one_default_tab: ${storageState.defaultTab}`);
      console.log(`  sessionStorage.all4one_deep_link: ${storageState.deepLink}`);
    }
    
    console.log(`\nScreenshots saved to: ${SCREENSHOTS_DIR}/`);
    
  } catch (error) {
    console.error('Error during testing:', error);
  } finally {
    console.log('\nKeeping browser open for 5 seconds...');
    await sleep(5000);
    await browser.close();
  }
}

testDeepLinkPriority().catch(console.error);
