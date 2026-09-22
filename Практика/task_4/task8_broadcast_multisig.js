// Задание 8.4: броадкаст программно подписанной транзакции (из задания 7) через RPC Bitcoin Core
// Запуск: node task8_broadcast_multisig.js <получатель> <сумма_sat>
// Транзакция собирается и подписывается в JS (bitcoinjs-lib), но отправляется не в mempool.space,
// а вызовом testmempoolaccept + sendrawtransaction на вашей ноде.
const { rpc } = require('./lib/rpc');
const { EXPLORER } = require('./lib/config');
const { describe } = require('./lib/tx');
const { buildMultisigTx } = require('./task7_multisig_spend');

async function main() {
  const [to, amountStr] = process.argv.slice(2);
  if (!to || !amountStr) {
    console.error('Использование: node task8_broadcast_multisig.js <получатель> <сумма_sat>');
    process.exit(1);
  }
  const res = await buildMultisigTx(to, parseInt(amountStr, 10));
  describe(res);

  // Проверка транзакции нодой без отправки
  const [check] = await rpc('testmempoolaccept', [[res.hex]]);
  console.log('testmempoolaccept:', JSON.stringify(check));
  if (!check.allowed) throw new Error(`Нода отклонила транзакцию: ${check['reject-reason']}`);

  const txid = await rpc('sendrawtransaction', [res.hex]);
  console.log(`\nОтправлено через Bitcoin Core! txid: ${txid}\n${EXPLORER}/tx/${txid}`);
}

main().catch((e) => { console.error('Ошибка:', e.message); process.exit(1); });
