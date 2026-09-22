const fs = require('fs');
const bitcoin = require('bitcoinjs-lib');
const ecc = require('tiny-secp256k1');
const { ECPairFactory } = require('ecpair');
bitcoin.initEccLib(ecc);
const ECPair = ECPairFactory(ecc);
const network = bitcoin.networks.testnet;
const EXPLORER = process.env.EXPLORER || 'https://mempool.space/testnet4';
const API_BASE = process.env.API_BASE || 'https://mempool.space/testnet4/api';
const KEY_FILE = process.env.KEY_FILE || 'secret_key.wif';

const DUST = 546;
const VB_P2PKH_IN = 148;
const VB_OUT = 34;
const OVERHEAD = 11;

function loadOrCreateKey(file = KEY_FILE) {
  if (fs.existsSync(file)) {
    const wif = fs.readFileSync(file, 'utf8').trim();
    return ECPair.fromWIF(wif, network);
  }
  const key = ECPair.makeRandom({ network });
  fs.writeFileSync(file, key.toWIF() + '\n', { mode: 0o600 });
  return key;
}

function legacyAddress(pubkey) {
  return bitcoin.payments.p2pkh({ pubkey, network }).address;
}

async function apiRequest(path, options = {}, asText = false) {
  const res = await fetch(API_BASE + path, options);
  const body = await res.text();
  if (!res.ok) 
    throw new Error(`HTTP ${res.status} ${path}: ${body}`);
  return asText ? body : JSON.parse(body);
}

const getUtxos = (addr) => apiRequest(`/address/${addr}/utxo`);
const getRawTxHex = (txid) => apiRequest(`/tx/${txid}/hex`, {}, true);
const broadcast = (hex) => apiRequest('/tx', { method: 'POST', body: hex, headers: { 'Content-Type': 'text/plain' } }, true);

async function getFeeRate() {
  try {
    const f = await apiRequest('/v1/fees/recommended');
    return Math.max(1, f.halfHourFee || 1);
  } catch {
    return 2;
  }
}

function planSpend(utxos, amount, feeRate) {
  const sorted = [...utxos].sort((a, b) => b.value - a.value);
  const selected = [];
  let total = 0;
  for (const u of sorted) {
    selected.push(u);
    total += u.value;
    const fee = Math.ceil((OVERHEAD + VB_P2PKH_IN * selected.length + VB_OUT * 2) * feeRate);
    if (total >= amount + fee) {
      const change = total - amount - fee;
      if (change < DUST) 
        return { selected, fee: total - amount, change: 0 };
      return { selected, fee, change };
    }
  }
  throw new Error(`Недостаточно средств: доступно ${total} sat, нужно ${amount} sat + комиссия`);
}

const validator = (pubkey, msghash, signature) =>
  ECPair.fromPublicKey(pubkey).verify(msghash, signature);

function finishPsbt(psbt) {
  if (!psbt.validateSignaturesOfAllInputs(validator)) {
    throw new Error('Подписи не прошли проверку');
  }
  psbt.finalizeAllInputs();
  const tx = psbt.extractTransaction();
  return {
    hex: tx.toHex(),
    txid: tx.getId(),
    vsize: tx.virtualSize(),
    fee: psbt.getFee(),
  };
}

async function main() {
  const key = loadOrCreateKey();
  const from = legacyAddress(key.publicKey);

  const dry = process.argv.includes('--dry');
  const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const to = args[0];
  const amount = parseInt(args[1] || '10000', 10);

  if (!to)
    throw new Error('Укажите адрес получателя: node index.js <адрес_получателя> <сумма_в_sat> [--dry]');

  bitcoin.address.toOutputScript(to, network);

  const utxos = await getUtxos(from);
  if (!utxos.length)
    throw new Error('На адресе нет UTXO');

  const feeRate = await getFeeRate();
  const plan = planSpend(utxos, amount, feeRate);

  console.log('='.repeat(88));
  console.log('  Отправка Bitcoin (testnet4)');
  console.log('-'.repeat(88));
  console.log('  Отправитель (Legacy): ', from);
  console.log('  Получатель: ', to);
  console.log('  Сумма: ', `${amount} sat`);
  console.log('  Ставка: ', `${feeRate} sat/vB`);
  console.log('  Входов: ', plan.selected.length);
  console.log('  Сдача: ', `${plan.change} sat`);
  console.log('-'.repeat(88));

  const psbt = new bitcoin.Psbt({ network });
  for (const u of plan.selected) {
    const prevHex = await getRawTxHex(u.txid);
    psbt.addInput({ hash: u.txid, index: u.vout, nonWitnessUtxo: Buffer.from(prevHex, 'hex') });
  }
  psbt.addOutput({ address: to, value: BigInt(amount) });
  if (plan.change > 0) 
    psbt.addOutput({ address: from, value: BigInt(plan.change) });

  psbt.signAllInputs(key);
  const res = finishPsbt(psbt);

  const feeNum = Number(res.fee);

  console.log('  txid: ', res.txid);
  console.log('  vsize: ', `${res.vsize} vB`);
  console.log('  Комиссия: ', `${feeNum} sat (${(feeNum / res.vsize).toFixed(2)} sat/vB)`);
  console.log('  hex: ', res.hex);
  console.log('-'.repeat(88));

  if (dry) {
    console.log('  --dry: транзакция не отправлена');
    console.log('='.repeat(88));
    return;
  }

  const txid = await broadcast(res.hex);
  console.log('  Отправлено, txid:', txid);
  console.log('='.repeat(88));
  console.log(`  ${EXPLORER}/tx/${txid}`);
  console.log('='.repeat(88));
}

main().catch((e) => {
  console.error('='.repeat(88));
  console.error('  Ошибка:', e.message);
  console.error('='.repeat(88));
  process.exit(1);
});
