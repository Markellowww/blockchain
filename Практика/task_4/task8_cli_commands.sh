#!/usr/bin/env bash
# Задание 8.1-8.2: справочник команд bitcoin-cli для testnet4 (запускайте по одной, это шпаргалка)
# Bitcoin Core должен быть версии 28.0+ (там появился testnet4)
set -e
CLI="bitcoin-cli -testnet4"

# --- Запуск ноды (или bitcoind -daemon -testnet4) ---
# bitcoind -testnet4 -daemon

# --- Состояние синхронизации и pruning ---
$CLI getblockchaininfo          # смотрим blocks/headers, verificationprogress, pruned=true

# --- Кошелёк и адрес для получения ---
$CLI createwallet testwallet
$CLI -rpcwallet=testwallet getnewaddress "faucet" bech32
# -> получите на него монеты из faucet, дождитесь подтверждения
$CLI -rpcwallet=testwallet getbalances
$CLI -rpcwallet=testwallet listunspent

# --- 8.1: перевод на другой свой адрес ---
# $CLI -rpcwallet=testwallet getnewaddress "second" bech32
# $CLI -rpcwallet=testwallet sendtoaddress <свой_второй_адрес> 0.0001

# --- 8.2: "ручной" перевод через raw-транзакцию ---
# 1) создать черновик транзакции (без входов), Core сам выберет UTXO и сдачу
# RAW=$($CLI -rpcwallet=testwallet createrawtransaction '[]' '{"<адрес_получателя>":0.0001}')
# FUNDED=$($CLI -rpcwallet=testwallet fundrawtransaction "$RAW" '{"fee_rate":2}' | jq -r .hex)
# 2) подписать ключами кошелька
# SIGNED=$($CLI -rpcwallet=testwallet signrawtransactionwithwallet "$FUNDED" | jq -r .hex)
# 3) проверить и отправить
# $CLI testmempoolaccept "[\"$SIGNED\"]"
# $CLI sendrawtransaction "$SIGNED"
# 4) посмотреть транзакцию
# $CLI -rpcwallet=testwallet gettransaction <txid>
