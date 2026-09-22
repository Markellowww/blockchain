// Задание 7 (часть 1): кошелёк с мультиподписью 2-из-2 (P2WSH)
// Запуск: node task7_multisig_create.js [--new]
const fs = require('fs');
const { EXPLORER } = require('./lib/config');
const { createKeys, loadKeys, buildPayment, MS_FILE } = require('./lib/multisig');

let keys;
if (!process.argv.includes('--new') && fs.existsSync(MS_FILE)) {
  keys = loadKeys();
  console.log(`Ключи загружены из ${MS_FILE}`);
} else {
  keys = createKeys();
  console.log(`Сгенерированы 2 ключа, сохранены в ${MS_FILE}`);
}

const p = buildPayment(keys);
console.log('Pubkey 1:', keys[0].publicKey.toString('hex'));
console.log('Pubkey 2:', keys[1].publicKey.toString('hex'));
console.log('Redeem (witness) script:', p.redeem.output.toString('hex'));
console.log('\nАдрес мультиподписи 2-of-2 (P2WSH):', p.address);
console.log(`Пополните его из faucet и посмотрите: ${EXPLORER}/address/${p.address}`);
