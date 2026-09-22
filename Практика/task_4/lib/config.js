const fs = require('fs');
const bitcoin = require('bitcoinjs-lib');
const ecc = require('tiny-secp256k1');
const { ECPairFactory } = require('ecpair');
const { BIP32Factory } = require('bip32');

bitcoin.initEccLib(ecc);

const ECPair = ECPairFactory(ecc);
const bip32 = BIP32Factory(ecc);

const network = bitcoin.networks.testnet;

const EXPLORER = process.env.EXPLORER || 'https://mempool.space/testnet4';
const KEY_FILE = process.env.KEY_FILE || 'key.wif';

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

module.exports = {
  bitcoin, ecc, ECPair, bip32, network, EXPLORER, KEY_FILE,
  saveKey, loadKey, legacyAddress, segwitAddress,
};
