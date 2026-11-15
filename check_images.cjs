const fs = require('fs');

const content = fs.readFileSync('index.html', 'utf8');
const logoIdx = content.indexOf('id="logoBox"');
const srcIdx = content.indexOf('src="', logoIdx);
const endSrc = content.indexOf('"', srcIdx + 5);
const src = content.slice(srcIdx + 5, endSrc);
const base64Data = src.replace(/^data:image\/\w+;base64,/, '');
const buffer = Buffer.from(base64Data, 'base64');
fs.writeFileSync('logo_extracted.png', buffer);
console.log('Logo saved, size:', (buffer.length / 1024).toFixed(1), 'KB');

// Fetch catalog from production
fetch('https://lanna-arts.pages.dev/api/catalog')
  .then(r => r.json())
  .then(data => {
    console.log('Catalog title:', data.title);
    console.log('Images count:', data.images ? data.images.length : 0);
    if (data.images && data.images.length) {
      console.log('First image sample:', JSON.stringify(data.images[0]).slice(0, 150));
    }
  })
  .catch(err => console.error('Fetch error:', err));
