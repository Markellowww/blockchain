const fs = require('fs');
const { bitcoin, ECPair, network } = require('./config');

const MS_FILE = process.env.MS_FILE || 'ms_keys.json';

function createKeys() {
  const keys = [ECPair.makeRandom({ network }), ECPair.makeRandom({ network })];
  fs.writeFileSync(MS_FILE, JSON.stringify({ wifs: keys.map((k) => k.toWIF()) }, null, 2), { mode: 0o600 });
  return keys;
}

function loadKeys() {
  const { wifs } = JSON.parse(fs.readFileSync(MS_FILE, 'utf8'));
  return wifs.map((w) => ECPair.fromWIF(w, network));
}

function buildPayment(keys) {
  const pubkeys = keys.map((k) => k.publicKey);
  return bitcoin.payments.p2wsh({
    redeem: bitcoin.payments.p2ms({ m: 2, pubkeys, network }),
    network,
  });
}

module.exports = { createKeys, loadKeys, buildPayment, MS_FILE };
