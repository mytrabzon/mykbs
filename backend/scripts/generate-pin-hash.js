// PIN Hash Oluşturma Scripti
// Kullanım: node scripts/generate-pin-hash.js

const bcrypt = require('bcryptjs');

async function generateHash() {
  const pin = '611633';
  const hash = await bcrypt.hash(pin, 10);
  console.log('PIN:', pin);
  console.log('Hash:', hash);
  console.log('\nBu hash\'i SQL script\'te kullanabilirsiniz.');
}

generateHash();

