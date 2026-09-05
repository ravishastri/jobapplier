import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  console.log('🌐 Opening Job Applier in browser...');
  
  try {
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
    console.log('✅ Browser opened successfully!');
    console.log('📍 URL: http://localhost:3000');
    console.log('');
    console.log('🎉 Job Applier is running in your browser!');
    console.log('');
    console.log('Press Ctrl+C to close browser and exit');
    
    // Keep browser open indefinitely
    await new Promise(() => {});
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('');
    console.error('Make sure these are running in separate terminals:');
    console.error('  Terminal 1: npm run db:up');
    console.error('  Terminal 2: npm run server');
    console.error('  Terminal 3: npm run dev:frontend');
    await browser.close();
    process.exit(1);
  }
})();
