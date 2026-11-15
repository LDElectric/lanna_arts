const fs = require('fs');

const buf = fs.readFileSync('logo_extracted.png');
// PNG width and height are at offset 16 and 20 (4 bytes each, big endian)
const width = buf.readUInt32BE(16);
const height = buf.readUInt32BE(20);
console.log('Logo dimensions:', width, 'x', height);
