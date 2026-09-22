const ecc = require('tiny-secp256k1');

const DUST = 546;
const VB = { p2pkh: 148, p2wpkh: 68, p2wsh_2of2: 105 };

function planSpend(utxos, amount, feeRate, inVb, outVb = 43, overhead = 11) {
  const sorted = [...utxos].sort((a, b) => b.value - a.value);
  const selected = [];
  let total = 0;
  for (const u of sorted) {
    selected.push(u);
    total += u.value;
    const fee2 = Math.ceil((overhead + inVb * selected.length + outVb * 2) * feeRate);
    if (total >= amount + fee2) {
      const change = total - amount - fee2;
      if (change < DUST) return { selected, fee: total - amount, change: 0 };
      return { selected, fee: fee2, change };
    }
  }
  throw new Error(`Недостаточно средств: доступно ${total} sat, нужно ${amount} sat + комиссия`);
}

const validator = (pubkey, msghash, signature) => ecc.verify(msghash, pubkey, signature);

function finishPsbt(psbt) {
  if (!psbt.validateSignaturesOfAllInputs(validator)) {
    throw new Error('Подписи не прошли проверку');
  }
  psbt.finalizeAllInputs();
  const tx = psbt.extractTransaction();
  return {
    tx,
    hex: tx.toHex(),
    txid: tx.getId(),
    vsize: tx.virtualSize(),
    fee: Number(psbt.getFee()),
  };
}

function describe(res) {
  console.log(`txid:  ${res.txid}`);
  console.log(`vsize: ${res.vsize} vB, комиссия: ${res.fee} sat (${(res.fee / res.vsize).toFixed(2)} sat/vB)`);
  console.log(`hex:   ${res.hex}`);
}

module.exports = { planSpend, finishPsbt, describe, VB, DUST };