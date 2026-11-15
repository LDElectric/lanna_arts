const fs = require('fs');

// 1. Read optimized logo and convert to base64
const optLogoBuf = fs.readFileSync('lanna-artes-logo-opt.png');
const optLogoBase64 = `data:image/png;base64,${optLogoBuf.toString('base64')}`;

// 2. Replace huge base64 logo in index.html
let html = fs.readFileSync('index.html', 'utf8');
const logoBoxIdx = html.indexOf('id="logoBox"');
if (logoBoxIdx !== -1) {
  const srcIdx = html.indexOf('src="', logoBoxIdx);
  const endSrc = html.indexOf('"', srcIdx + 5);
  html = html.slice(0, srcIdx + 5) + optLogoBase64 + html.slice(endSrc);
  console.log('Replaced logo in index.html with optimized base64');
}

fs.writeFileSync('index.html', html, 'utf8');
console.log('index.html updated. New file size:', (fs.statSync('index.html').size / 1024).toFixed(1), 'KB');

// 3. Update build.mjs to use optimized QR codes
let buildScript = fs.readFileSync('build.mjs', 'utf8');
buildScript = buildScript.replace('"qr-instagram-transparente.png"', '"qr-instagram-opt.png"');
buildScript = buildScript.replace('"qr-tiktok-transparente.png"', '"qr-tiktok-opt.png"');
fs.writeFileSync('build.mjs', buildScript, 'utf8');
console.log('build.mjs updated with optimized QR codes');
