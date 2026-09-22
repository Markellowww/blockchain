const HOST = process.env.RPC_HOST || '127.0.0.1';
const PORT = process.env.RPC_PORT || '48332'; // порт RPC для testnet4
const USER = process.env.RPC_USER || 'btcuser';
const PASS = process.env.RPC_PASS || 'btcpass';
const WALLET = process.env.RPC_WALLET || 'testwallet';

async function rpc(method, params = [], wallet = null) {
  const url = `http://${HOST}:${PORT}` + (wallet ? `/wallet/${encodeURIComponent(wallet)}` : '/');
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Basic ' + Buffer.from(`${USER}:${PASS}`).toString('base64'),
    },
    body: JSON.stringify({ jsonrpc: '1.0', id: 'lab', method, params }),
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { throw new Error(`HTTP ${res.status}: ${text}`); }
  if (json.error) throw new Error(`RPC ${method}: ${json.error.message} (код ${json.error.code})`);
  return json.result;
}

module.exports = { rpc, WALLET };
