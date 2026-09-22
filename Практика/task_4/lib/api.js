const BASE = process.env.API_BASE || 'https://mempool.space/testnet4/api';

async function request(path, options = {}, asText = false) {
  const res = await fetch(BASE + path, options);
  const body = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status} ${path}: ${body}`);
  return asText ? body : JSON.parse(body);
}

const getAddressInfo = (addr) => request(`/address/${addr}`);
const getUtxos = (addr) => request(`/address/${addr}/utxo`);
const getRawTxHex = (txid) => request(`/tx/${txid}/hex`, {}, true);
const getTx = (txid) => request(`/tx/${txid}`);

const broadcast = (hex) =>
  request('/tx', { method: 'POST', body: hex, headers: { 'Content-Type': 'text/plain' } }, true);

async function getFeeRate() {
  try {
    const f = await request('/v1/fees/recommended');
    return Math.max(1, f.halfHourFee || 1);
  } catch {
    return 2;
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

module.exports = { getAddressInfo, getUtxos, getRawTxHex, getTx, broadcast, getFeeRate, sleep };
