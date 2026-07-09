const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('http://localhost:5174/');
  await page.waitForTimeout(2000);
  const text = await page.evaluate(() => document.body.innerText);
  console.log("BODY:", text);
  await browser.close();
})();
