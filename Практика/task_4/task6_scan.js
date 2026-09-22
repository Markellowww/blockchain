const fs = require('fs');
const bip39 = require('bip39');
const { bitcoin, bip32, network, EXPLORER } = require('./lib/config');
const api = require('./lib/api');

const TYPES = {
  p2pkh: { purpose: 44, pay: (pubkey) => bitcoin.payments.p2pkh({ pubkey, network }) },
  'p2sh-p2wpkh': {
    purpose: 49,
    pay: (pubkey) => bitcoin.payments.p2sh({ redeem: bitcoin.payments.p2wpkh({ pubkey, network }), network }),
  },
  p2wpkh: { purpose: 84, pay: (pubkey) => bitcoin.payments.p2wpkh({ pubkey, network }) },
};

function getRoot() {
  if (process.env.MNEMONIC) {
    const m = process.env.MNEMONIC.trim();
    if (!bip39.validateMnemonic(m)) throw new Error('Некорректная seed-фраза');
    return bip32.fromSeed(bip39.mnemonicToSeedSync(m, process.env.PASSPHRASE || ''), network);
  }
  if (process.env.XPRV) return bip32.fromBase58(process.env.XPRV.trim(), network);
  throw new Error('Задайте MNEMONIC или XPRV');
}

async function main() {
  const limit = parseInt(process.argv[2] || '20', 10);
  const root = getRoot();
  const found = [];

  // Список "аккаунтов" для перебора
  const accounts = [];
  if (root.depth === 0) {
    for (const [type, t] of Object.entries(TYPES)) {
      const basePath = `m/${t.purpose}'/1'/0'`; // coin type 1 = testnet
      accounts.push({ type, basePath, node: root.derivePath(basePath) });
    }
  } else {
    const type = process.env.TYPE || 'p2wpkh';
    accounts.push({ type, basePath: `(account xpriv, depth ${root.depth})`, node: root });
  }

  for (const acc of accounts) {
    console.log(`\n=== ${acc.type}: ${acc.basePath} ===`);
    for (const chain of [0, 1]) { // 0 — внешние, 1 — адреса сдачи
      for (let i = 0; i < limit; i++) {
        const child = acc.node.derive(chain).derive(i);
        const address = TYPES[acc.type].pay(child.publicKey).address;
        const info = await api.getAddressInfo(address);
        const txs = info.chain_stats.tx_count + info.mempool_stats.tx_count;
        const balance =
          info.chain_stats.funded_txo_sum - info.chain_stats.spent_txo_sum +
          info.mempool_stats.funded_txo_sum - info.mempool_stats.spent_txo_sum;
        if (txs > 0) {
          const path = root.depth === 0 ? `${acc.basePath}/${chain}/${i}` : `${chain}/${i}`;
          console.log(`  [${chain}/${i}] ${address}  tx: ${txs}  баланс: ${balance} sat` + (balance > 0 ? '  <-- ЕСТЬ МОНЕТЫ' : ''));
          found.push({ type: acc.type, path, address, balance, txs });
        }
        await api.sleep(120); // не превышаем лимиты публичного API
      }
    }
  }

  fs.writeFileSync('found.json', JSON.stringify(found, null, 2));
  console.log(`\nНайдено использованных адресов: ${found.length} (сохранено в found.json)`);
  const spendable = found.filter((f) => f.balance > 0);
  if (spendable.length) {
    console.log('Адреса с монетами:');
    spendable.forEach((f) => console.log(`  ${f.path}  ${f.address}  ${f.balance} sat  ${EXPLORER}/address/${f.address}`));
  } else {
    console.log('Адресов с ненулевым балансом не найдено. Увеличьте лимит или проверьте, что монеты именно в testnet4.');
  }
}

main().catch((e) => { 
  console.error('Ошибка:', e.message); 
  process.exit(1);
});
