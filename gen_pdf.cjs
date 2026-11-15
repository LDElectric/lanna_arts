const puppeteer = require('puppeteer-core');
const path = require('path');

(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: 'new',
    args: ['--no-sandbox', '--disable-gpu']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 900 });

  console.log('Navigating to https://lanna-arts.pages.dev/ ...');
  await page.goto('https://lanna-arts.pages.dev/', { waitUntil: 'networkidle0', timeout: 30000 });

  // Wait for frames to render (the catalog loads via JS)
  console.log('Waiting for catalog to load...');
  await page.waitForSelector('.frame:not(.empty)', { timeout: 15000 }).catch(() => {
    console.log('No .frame:not(.empty) found, catalog may be empty');
  });

  // Extra wait for images to load
  await new Promise(r => setTimeout(r, 3000));

  // Add has-print-qr class so print CSS shows content
  await page.evaluate(() => {
    document.body.classList.add('has-print-qr');

    // Also trigger updateRenderedTransforms if it exists
    if (typeof updateRenderedTransforms === 'function') {
      updateRenderedTransforms();
    }
  });

  // Wait a bit for any re-rendering
  await new Promise(r => setTimeout(r, 1000));

  const outPath = path.resolve('catalogo_preview.pdf');

  await page.pdf({
    path: outPath,
    format: 'A4',
    printBackground: true,
    margin: { top: 0, right: 0, bottom: 0, left: 0 },
    displayHeaderFooter: false,
  });

  console.log(`PDF generated: ${outPath}`);
  await browser.close();
})();
