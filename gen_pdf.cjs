const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

(async () => {
  const url = process.argv[2] || 'https://lanna-arts.pages.dev/';
  const outPath = path.resolve(process.argv[3] || 'catalogo_preview.pdf');

  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: 'new',
    args: ['--no-sandbox', '--disable-gpu']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 900 });

  console.log(`Navegando para ${url} ...`);
  await page.goto(url, { waitUntil: 'networkidle0', timeout: 45000 });
  await page.waitForSelector('.frame:not(.empty)', { timeout: 20000 });

  // Mesmo preparo usado pela exportação em produção (miniaturas + páginas A4)
  await page.evaluate(async () => {
    if (typeof preparePrintCatalog !== 'function') {
      throw new Error('A página não expôs preparePrintCatalog.');
    }
    await preparePrintCatalog();
    if (!document.querySelector('#printPages .frame')) {
      throw new Error('Os desenhos do catálogo não foram carregados.');
    }
  });

  await page.pdf({
    path: outPath,
    format: 'A4',
    printBackground: true,
    margin: { top: 0, right: 0, bottom: 0, left: 0 },
    displayHeaderFooter: false,
  });

  const sizeKB = (fs.statSync(outPath).size / 1024).toFixed(1);
  console.log(`PDF gerado: ${outPath} (${sizeKB} KB)`);
  await browser.close();
})();
