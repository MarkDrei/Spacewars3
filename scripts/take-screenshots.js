// Script to take screenshots of authenticated pages
const { chromium } = require('playwright');

async function takeScreenshots() {
  console.log('Starting browser...');
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 }
  });
  const page = await context.newPage();

  try {
    // Navigate to login page
    console.log('Navigating to login page...');
    await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });
    
    // Wait a bit for any client-side rendering
    await page.waitForTimeout(2000);
    
    // Take screenshot of login page
    console.log('Taking screenshot of login page...');
    await page.screenshot({ path: 'screenshots/01-login.png', fullPage: true });

    // Fill in login form with default user
    console.log('Logging in as user "a"...');
    await page.fill('input[name="username"]', 'a');
    await page.fill('input[name="password"]', 'a');
    
    // Click the sign in button
    await page.click('button[type="submit"]');
    
    // Wait for navigation to complete
    console.log('Waiting for navigation after login...');
    await page.waitForURL('**/game', { timeout: 10000 });
    
    // Wait for the page to fully load
    await page.waitForTimeout(3000);
    await page.waitForLoadState('networkidle');
    
    // Take screenshot of game page
    console.log('Taking screenshot of game page...');
    await page.screenshot({ path: 'screenshots/02-game.png', fullPage: true });

    // Navigate to about page
    console.log('Navigating to about page...');
    await page.goto('http://localhost:3000/about', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    
    console.log('Taking screenshot of about page...');
    await page.screenshot({ path: 'screenshots/03-about.png', fullPage: true });

    // Navigate to home page (or profile page if available)
    console.log('Navigating to home page...');
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    
    console.log('Taking screenshot of home page...');
    await page.screenshot({ path: 'screenshots/04-home.png', fullPage: true });

    // Navigate to research page if available
    console.log('Navigating to research page...');
    await page.goto('http://localhost:3000/research', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    
    console.log('Taking screenshot of research page...');
    await page.screenshot({ path: 'screenshots/05-research.png', fullPage: true });

    // Navigate to factory page if available
    console.log('Navigating to factory page...');
    await page.goto('http://localhost:3000/factory', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    
    console.log('Taking screenshot of factory page...');
    await page.screenshot({ path: 'screenshots/06-factory.png', fullPage: true });

    console.log('All screenshots captured successfully!');
  } catch (error) {
    console.error('Error taking screenshots:', error);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

takeScreenshots();
