// Задание 7 (часть 2): перевод монет с мультиподпись-адреса (нужны обе подписи)
// Запуск: node task7_multisig_spend.js <получатель> <сумма_sat> [--dry]
// Функция buildMultisigTx экспортируется и используется в задании 8.4
const { bitcoin, network, EXPLORER } = require('./lib/config');
const api = require('./lib/api');
const { loadKeys, buildPayment } = require('./lib/multisig');
const { planSpend, finishPsbt, describe, VB } = require('./lib/tx');

async function buildMultisigTx(to, amount) {
  const keys = loadKeys();
  const payment = buildPayment(keys);
  const from = payment.address;
  bitcoin.address.toOutputScript(to, network);

  const utxos = await api.getUtxos(from);
  if (!utxos.length) throw new Error(`На мультиподпись-адресе ${from} нет UTXO`);
  const feeRate = await api.getFeeRate();
  const plan = planSpend(utxos, amount, feeRate, VB.p2wsh_2of2, 43);

  const psbt = new bitcoin.Psbt({ network });
for (const u of plan.selected) {
  psbt.addInput({
    hash: u.txid,
    index: u.vout,
    witnessUtxo: {
      script: payment.output,
      value: BigInt(u.value),          // ← было u.value (number)
    },
    witnessScript: payment.redeem.output,
  });
}
psbt.addOutput({ address: to, value: BigInt(amount) });               // ← BigInt
if (plan.change > 0) {
  psbt.addOutput({ address: from, value: BigInt(plan.change) });      // ← BigInt
}

  // Подписи обоих участников (в реальности — на разных устройствах, обмениваясь PSBT)
  psbt.signAllInputs(keys[0]);
  psbt.signAllInputs(keys[1]);
  return { ...finishPsbt(psbt), from, feeRate };
}

async function main() {
  const dry = process.argv.includes('--dry');
  const [to, amountStr] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  if (!to || !amountStr) {
    console.error('Использование: node task7_multisig_spend.js <получатель> <сумма_sat> [--dry]');
    process.exit(1);
  }
  const res = await buildMultisigTx(to, parseInt(amountStr, 10));
  console.log(`Отправитель (2-of-2): ${res.from}`);
  describe(res);
  if (dry) return console.log('--dry: транзакция не отправлена');
  const txid = await api.broadcast(res.hex);
  console.log(`\nОтправлено! txid: ${txid}\n${EXPLORER}/tx/${txid}`);
}

module.exports = { buildMultisigTx };

if (require.main === module) {
  main().catch((e) => { console.error('Ошибка:', e.message); process.exit(1); });
}
