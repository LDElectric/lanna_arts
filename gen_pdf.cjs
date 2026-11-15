const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: 'new',
    args: ['--no-sandbox', '--disable-gpu']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 900 });

  console.log('Navegando para https://lanna-arts.pages.dev/ ...');
  await page.goto('https://lanna-arts.pages.dev/', { waitUntil: 'networkidle0', timeout: 30000 });

  await page.waitForSelector('.frame:not(.empty)', { timeout: 15000 }).catch(() => {
    console.log('Aguardando catálogo...');
  });

  await new Promise(r => setTimeout(r, 2000));

  // Prepara estado de impressão e garante que o Pix seja visível para teste visual
  await page.evaluate(() => {
    document.body.classList.add('has-print-qr');
    const qrPrintBox = document.getElementById('qrPrintBox');
    const qrPrintImage = document.getElementById('qrPrintImage');
    
    // Se o Pix não estiver configurado no banco ainda, colocamos um QR demonstrativo para visualização
    if (!qrPrintBox.classList.contains('has-pix') || !qrPrintImage.src) {
      qrPrintBox.classList.add('has-pix');
      qrPrintImage.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect width="100" height="100" fill="%23fff"/><rect x="10" y="10" width="80" height="80" rx="8" fill="%239C2756"/><text x="50" y="58" fill="%23fff" font-family="sans-serif" font-weight="bold" font-size="22" text-anchor="middle">PIX</text></svg>';
    }

    if (typeof updateRenderedTransforms === 'function') {
      updateRenderedTransforms();
    }
  });

  await new Promise(r => setTimeout(r, 1000));

  const outPath = path.resolve('catalogo_preview.pdf');

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
