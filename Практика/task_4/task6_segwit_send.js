// Задание 6.2: транзакция с SegWit-адреса (P2WPKH) ключом, импортированным из кошелька
// Запуск:
//   MNEMONIC="..." node task6_segwit_send.js <путь> <адрес-получатель> <сумма_sat> [--dry]
//   XPRV="tprv..." node task6_segwit_send.js <путь> <получатель> <сумма_sat>
//   <путь> берётся из found.json, например: m/84'/1'/0'/0/0
//   (для account-xprv путь автоматически сокращается до последних двух компонентов, например 0/0)
const bip39 = require('bip39');
const { bitcoin, bip32, network, EXPLORER } = require('./lib/config');
const api = require('./lib/api');
const { planSpend, finishPsbt, describe, VB } = require('./lib/tx');

function getRoot() {
  if (process.env.MNEMONIC) {
    return bip32.fromSeed(bip39.mnemonicToSeedSync(process.env.MNEMONIC.trim(), process.env.PASSPHRASE || ''), network);
  }
  if (process.env.XPRV) return bip32.fromBase58(process.env.XPRV.trim(), network);
  throw new Error('Задайте MNEMONIC или XPRV');
}

async function main() {
  const dry = process.argv.includes('--dry');
  const [path, to, amountStr] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  if (!path || !to || !amountStr) {
    console.error("Использование: node task6_segwit_send.js <путь> <получатель> <сумма_sat> [--dry]");
    process.exit(1);
  }
  const amount = parseInt(amountStr, 10);
  const root = getRoot();
  const relPath = root.depth === 0 ? path : path.split('/').slice(-2).join('/');
  const node = root.derivePath(relPath);

  const payment = bitcoin.payments.p2wpkh({ pubkey: node.publicKey, network });
  const from = payment.address;
  console.log(`Отправитель (SegWit): ${from}  (${path})`);
  bitcoin.address.toOutputScript(to, network);

  const utxos = await api.getUtxos(from);
  if (!utxos.length) throw new Error('На этом адресе нет UTXO');
  const feeRate = await api.getFeeRate();
  const plan = planSpend(utxos, amount, feeRate, VB.p2wpkh, 43);
  console.log(`Ставка: ${feeRate} sat/vB, входов: ${plan.selected.length}, сдача: ${plan.change} sat`);

  const psbt = new bitcoin.Psbt({ network });
  for (const u of plan.selected) {
    // Для SegWit достаточно witnessUtxo: скрипт и сумму
    psbt.addInput({
  hash: u.txid,
  index: u.vout,
  witnessUtxo: { script: payment.output, value: BigInt(u.value) },
  });
  }
  psbt.addOutput({ address: to, value: BigInt(amount) });
  if (plan.change > 0) psbt.addOutput({ address: from, value: BigInt(plan.change) });

  psbt.signAllInputs(node); // BIP32-узел подходит как подписывающий ключ
  const res = finishPsbt(psbt);
  describe(res);

  if (dry) return console.log('--dry: транзакция не отправлена');
  const txid = await api.broadcast(res.hex);
  console.log(`\nОтправлено! txid: ${txid}\n${EXPLORER}/tx/${txid}`);
}

main().catch((e) => { console.error('Ошибка:', e.message); process.exit(1); });
