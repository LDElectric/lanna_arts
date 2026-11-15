const fs = require('fs');

const buf = fs.readFileSync('catalogo_preview.pdf');
const content = buf.toString('binary');

// Find all streams and images
const streamMatches = content.match(/\/Length\s+(\d+)/g) || [];
console.log('Stream lengths count:', streamMatches.length);

// Sort streams by length
const lengths = streamMatches.map(m => parseInt(m.replace(/\D/g, ''))).sort((a,b) => b - a);
console.log('Top 10 stream sizes (KB):', lengths.slice(0, 10).map(s => (s/1024).toFixed(1)));

// Let's see what is inside the largest streams
const imageMatches = content.match(/\/Subtype\s*\/Image/g) || [];
console.log('Image objects count:', imageMatches.length);
