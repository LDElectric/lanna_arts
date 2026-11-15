const fs = require('fs');

const content = fs.readFileSync('index.html', 'utf8');
const logoIdx = content.indexOf('id="logoBox"');
if (logoIdx !== -1) {
  const srcIdx = content.indexOf('src="', logoIdx);
  const endSrc = content.indexOf('"', srcIdx + 5);
  const src = content.slice(srcIdx + 5, endSrc);
  console.log('Logo src length:', src.length, 'bytes (~' + (src.length / 1024 / 1024).toFixed(2) + ' MB)');
}

// Let's also check the size of index.html
console.log('index.html total size:', (fs.statSync('index.html').size / 1024 / 1024).toFixed(2), 'MB');
