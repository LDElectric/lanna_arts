const fs = require('fs');

const buf = fs.readFileSync('catalogo_preview.pdf');
const content = buf.toString('binary');

let regex = /<<([^>]*\/Length\s+(\d+)[^>]*)>>\s*stream\r?\n/g;
let match;
while ((match = regex.exec(content)) !== null) {
  const dict = match[1];
  const len = parseInt(match[2]);
  if (len > 100000) { // > 100KB
    console.log('Stream length:', (len/1024).toFixed(1), 'KB | Dict:', dict.replace(/\s+/g, ' '));
  }
}
