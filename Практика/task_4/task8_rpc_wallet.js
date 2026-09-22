// Задание 8.3: баланс и отправка монет из кошелька Bitcoin Core через RPC
// Запуск:
//   node task8_rpc_wallet.js info                       — информация о ноде (синхронизация, prune)
//   node task8_rpc_wallet.js balance                    — баланс кошелька
//   node task8_rpc_wallet.js utxos                      — список UTXO
//   node task8_rpc_wallet.js newaddress                 — новый адрес для получения
//   node task8_rpc_wallet.js send <адрес> <сумма_tBTC>  — отправка монет
// Переменные: RPC_HOST, RPC_PORT (48332), RPC_USER, RPC_PASS, RPC_WALLET
const { rpc, WALLET } = require('./lib/rpc');
const { EXPLORER } = require('./lib/config');

async function ensureWallet() {
  const loaded = await rpc('listwallets');
  if (loaded.includes(WALLET)) return;
  try { await rpc('loadwallet', [WALLET]); }
  catch { await rpc('createwallet', [WALLET]); console.log(`Создан кошелёк ${WALLET}`); }
}

async function main() {
  const [cmd, a1, a2] = process.argv.slice(2);
  switch (cmd) {
    case 'info': {
      const i = await rpc('getblockchaininfo');
      console.log(`chain: ${i.chain}, блоки: ${i.blocks}/${i.headers}, прогресс: ${(i.verificationprogress * 100).toFixed(2)}%`);
      console.log(`pruned: ${i.pruned}` + (i.pruned ? `, pruneheight: ${i.pruneheight}` : ''));
      break;
    }
    case 'balance': {
      await ensureWallet();
      const b = await rpc('getbalances', [], WALLET);
      console.log(`Подтверждено:    ${b.mine.trusted} tBTC`);
      console.log(`Неподтверждено:  ${b.mine.untrusted_pending} tBTC`);
      break;
    }
    case 'utxos': {
      await ensureWallet();
      const list = await rpc('listunspent', [0], WALLET);
      list.forEach((u) => console.log(`${u.txid}:${u.vout}  ${u.address}  ${u.amount} tBTC  conf=${u.confirmations}`));
      if (!list.length) console.log('UTXO нет');
      break;
    }
    case 'newaddress': {
      await ensureWallet();
      console.log(await rpc('getnewaddress', ['lab', 'bech32'], WALLET));
      break;
    }
    case 'send': {
      if (!a1 || !a2) throw new Error('Использование: send <адрес> <сумма_tBTC>');
      await ensureWallet();
      const txid = await rpc('sendtoaddress', { address: a1, amount: parseFloat(a2), fee_rate: 2 }, WALLET);
      console.log(`Отправлено! txid: ${txid}\n${EXPLORER}/tx/${txid}`);
      break;
    }
    default:
      console.log('Команды: info | balance | utxos | newaddress | send <адрес> <сумма>');
  }
}

main().catch((e) => { console.error('Ошибка:', e.message); process.exit(1); });
