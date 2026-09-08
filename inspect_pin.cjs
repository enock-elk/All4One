const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const SCREENSHOTS_DIR = '/tmp/all4one_test_screenshots';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function inspectPinStructure() {
  console.log('\n=== Inspecting Pin Structure ===\n');
  
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: { width: 1920, height: 1080 },
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
  });

  const page = await browser.newPage();
  
  try {
    // Clear storage and visit Affidavit
    await page.goto('http://127.0.0.1:5502/', { waitUntil: 'networkidle2' });
    await page.evaluate(() => {
      localStorage.removeItem('all4one_default_tab');
      sessionStorage.clear();
    });
    
    await page.goto('http://127.0.0.1:5502/AffidavitAutomation', { waitUntil: 'networkidle2' });
    await sleep(2000);
    
    // Get sidebar HTML
    const sidebarHTML = await page.evaluate(() => {
      const sidebar = document.querySelector('[class*="sidebar"]') || 
                      document.querySelector('nav') ||
                      document.querySelector('aside');
      return sidebar ? sidebar.outerHTML : 'Sidebar not found';
    });
    
    fs.writeFileSync('/tmp/sidebar_html.txt', sidebarHTML);
    console.log('Sidebar HTML saved to /tmp/sidebar_html.txt');
    
    // Check localStorage
    const localStorage = await page.evaluate(() => {
      return JSON.stringify(window.localStorage);
    });
    console.log('LocalStorage:', localStorage);
    
    // Get all items with "Affidavit" in class or text
    const affidavitInfo = await page.evaluate(() => {
      const results = [];
      const elements = [...document.querySelectorAll('*')];
      
      for (const el of elements) {
        const classList = el.className || '';
        const text = el.textContent || '';
        
        if (classList.includes('Affidavit') || text.includes('Affidavit Automation')) {
          results.push({
            tag: el.tagName,
            classList: classList,
            innerHTML: el.innerHTML.substring(0, 200),
            hasPinIcon: el.innerHTML.includes('📌'),
            hasStarIcon: el.innerHTML.includes('⭐'),
            hasPinClass: classList.includes('pin') || classList.includes('Pin')
          });
        }
      }
      
      return results;
    });
    
    console.log('\nAffidavit elements found:', JSON.stringify(affidavitInfo, null, 2));
    
    await browser.close();
  } catch (error) {
    console.error('Error:', error);
    await browser.close();
  }
}

inspectPinStructure().catch(console.error);
