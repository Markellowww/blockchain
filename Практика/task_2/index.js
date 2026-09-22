const fs = require('fs');
const bitcoin = require('bitcoinjs-lib');
const ecc = require('tiny-secp256k1');
const { ECPairFactory } = require('ecpair');
bitcoin.initEccLib(ecc);
const ECPair = ECPairFactory(ecc);
const network = bitcoin.networks.testnet;
const EXPLORER = process.env.EXPLORER || 'https://mempool.space/testnet4';
const KEY_FILE = process.env.KEY_FILE || 'secret_key.wif';

function saveKey(keyPair, file = KEY_FILE) {
  fs.writeFileSync(file, keyPair.toWIF() + '\n', { mode: 0o600 });
}

function loadKey(file = KEY_FILE) {
  const wif = fs.readFileSync(file, 'utf8').trim();
  return ECPair.fromWIF(wif, network);
}

function legacyAddress(pubkey) {
  return bitcoin.payments.p2pkh({ pubkey, network }).address;
}

function segwitAddress(pubkey) {
  return bitcoin.payments.p2wpkh({ pubkey, network }).address;
}

function loadOrCreateKey() {
  if (!process.argv.includes('--new') && fs.existsSync(KEY_FILE)) {
    const keyPair = loadKey();
    console.log(`Ключ загружен из ${KEY_FILE}`);
    return keyPair;
  }

  const keyPair = ECPair.makeRandom({ network });
  saveKey(keyPair);
  return keyPair;
}

function main() {
  console.log('='.repeat(88));
  console.log('  Генерация ключа и адресов Bitcoin (testnet4)');
  console.log('='.repeat(88));

  try {
    const keyPair = loadOrCreateKey();

    const pub = Buffer.from(keyPair.publicKey);
    const legacy = legacyAddress(pub);
    const segwit = segwitAddress(pub);

    console.log('  Публичный ключ:  ', pub.toString('hex'));
    console.log('  Legacy (P2PKH):  ', legacy);
    console.log('  SegWit (P2WPKH): ', segwit);
    console.log(`  Новый ключ сгенерирован и сохранен в ${KEY_FILE}`);
    console.log('='.repeat(88));

    console.log(`  ${EXPLORER}/address/${legacy}`);
    console.log(`  ${EXPLORER}/address/${segwit}`);
  } catch (err) {
    console.error('  Не удалось сгенерировать/загрузить ключ и адреса');
    console.error(err.message);
    process.exitCode = 1;
  }
}

main();
