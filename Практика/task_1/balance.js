const API_BASE = "https://mempool.space/testnet4/api";

function satoshiToBtc(sat) {
  return (sat / 100_000_000).toFixed(8);
}

async function fetchAddressInfo(address) {
  const url = `${API_BASE}/address/${address}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Ошибка запроса к API: ${response.status} ${response.statusText}`
    );
  }

  return response.json();
}

function calculateBalance(info) {
  const confirmed = info.chain_stats.funded_txo_sum - info.chain_stats.spent_txo_sum;
  const unconfirmed = info.mempool_stats.funded_txo_sum - info.mempool_stats.spent_txo_sum;

  return {
    confirmedSat: confirmed,
    unconfirmedSat: unconfirmed,
    totalSat: confirmed + unconfirmed,
  };
}

async function main() {
  const address = process.argv[2];

  if (!address) {
    console.error("Не указан адрес");
    console.error("Используйте: node balance.js <адрес>");
    process.exitCode = 1;
    return;
  }

  console.log("=".repeat(60));
  console.log("  Проверка баланса Bitcoin-адреса в mempool.space (testnet4)");
  console.log(`  Адрес: ${address}`);
  console.log("=".repeat(60));

  try {
    const info = await fetchAddressInfo(address);
    const balance = calculateBalance(info);

    console.log(`  Подтвержденных транзакций: ${info.chain_stats.tx_count}`);
    console.log(`  Транзакций в мемпуле: ${info.mempool_stats.tx_count}`);
    console.log("-".repeat(60));
    console.log(
      `  Подтвержденный баланс: ${balance.confirmedSat} сатоши  (${satoshiToBtc(
        balance.confirmedSat
      )} BTC)`
    );
    console.log(
      `  Неподтвержденный баланс: ${balance.unconfirmedSat} сатоши (${satoshiToBtc(
        balance.unconfirmedSat
      )} BTC)`
    );
    console.log("-".repeat(60));
    console.log(
      `  Итоговый баланс: ${balance.totalSat} сатоши (${satoshiToBtc(
        balance.totalSat
      )} BTC)`
    );
    console.log("=".repeat(60));
  } catch (err) {
    console.error("  Не удалось получить баланс адреса");
    console.error(err.message);
    process.exitCode = 1;
  }
}

main();
