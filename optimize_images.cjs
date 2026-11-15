const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

async function optimizeImages() {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: 'new',
    args: ['--no-sandbox', '--disable-gpu']
  });

  const page = await browser.newPage();

  async function resizeImage(inputPath, outputPath, targetWidth) {
    const imgBuffer = fs.readFileSync(inputPath);
    const base64 = imgBuffer.toString('base64');
    const mime = inputPath.endsWith('.jpg') ? 'image/jpeg' : 'image/png';
    const dataUri = `data:${mime};base64,${base64}`;

    const resultDataUri = await page.evaluate(async (uri, targetW) => {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          const ratio = targetW / img.width;
          const targetH = Math.round(img.height * ratio);
          const canvas = document.createElement('canvas');
          canvas.width = targetW;
          canvas.height = targetH;
          const ctx = canvas.getContext('2d');
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, targetW, targetH);
          resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = reject;
        img.src = uri;
      });
    }, dataUri, targetWidth);

    const outBuf = Buffer.from(resultDataUri.replace(/^data:image\/png;base64,/, ''), 'base64');
    fs.writeFileSync(outputPath, outBuf);
    console.log(`Optimized ${path.basename(inputPath)} -> ${path.basename(outputPath)}: ${(imgBuffer.length / 1024).toFixed(1)} KB -> ${(outBuf.length / 1024).toFixed(1)} KB`);
  }

  // 1. Logo (displayed at 22mm x 22mm, so 400px width is ~460 DPI!)
  await resizeImage('logo_extracted.png', 'lanna-artes-logo-opt.png', 400);

  // 2. Instagram QR (displayed at 14mm x 14mm, 300px is ~540 DPI!)
  await resizeImage(path.resolve('QRcodes', 'qr-instagram-transparente.png'), path.resolve('QRcodes', 'qr-instagram-opt.png'), 300);

  // 3. TikTok QR (displayed at 14mm x 14mm, 300px is ~540 DPI!)
  await resizeImage(path.resolve('QRcodes', 'qr-tiktok-transparente.png'), path.resolve('QRcodes', 'qr-tiktok-opt.png'), 300);

  await browser.close();
  console.log('Image optimization complete!');
}

optimizeImages().catch(err => console.error(err));
