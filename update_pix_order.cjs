const fs = require('fs');

let html = fs.readFileSync('index.html', 'utf8');

// Update #qrPrintBox HTML order
const oldPixHtml = `<div class="qr-box" id="qrPrintBox" aria-hidden="true">
        <span class="pix-label">Pix</span>
        <div class="pix-print-frame">
          <img id="qrPrintImage" alt="">
        </div>
      </div>`;

const newPixHtml = `<div class="qr-box" id="qrPrintBox" aria-hidden="true">
        <div class="pix-print-frame">
          <img id="qrPrintImage" alt="">
        </div>
        <span class="pix-label">Pix</span>
      </div>`;

if (html.includes(oldPixHtml)) {
  html = html.replace(oldPixHtml, newPixHtml);
  console.log('Updated #qrPrintBox HTML');
} else {
  console.log('oldPixHtml not matched exactly, checking regex');
  html = html.replace(
    /<div class="qr-box" id="qrPrintBox" aria-hidden="true">[\s\S]*?<\/div>[\s\S]*?<\/div>/,
    `<div class="qr-box" id="qrPrintBox" aria-hidden="true">\n        <div class="pix-print-frame">\n          <img id="qrPrintImage" alt="">\n        </div>\n        <span class="pix-label">Pix</span>\n      </div>`
  );
  console.log('Updated #qrPrintBox HTML via regex');
}

fs.writeFileSync('index.html', html, 'utf8');
