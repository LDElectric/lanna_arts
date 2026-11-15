const fs = require('fs');

async function test() {
  const r = await fetch('https://lanna-arts.pages.dev/api/catalog');
  const data = await r.json();
  let totalImgBytes = 0;
  for (const img of data.images) {
    const url = 'https://lanna-arts.pages.dev' + img.src;
    const res = await fetch(url);
    const buf = await res.arrayBuffer();
    totalImgBytes += buf.byteLength;
    console.log(`Image ${img.id}: ${(buf.byteLength / 1024).toFixed(1)} KB`);
  }
  console.log(`Total images size: ${(totalImgBytes / 1024 / 1024).toFixed(2)} MB`);
  console.log(`Logo size: ${(fs.statSync('logo_extracted.png').size / 1024 / 1024).toFixed(2)} MB`);
}

test();
