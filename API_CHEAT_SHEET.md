# Quantix (QTX) API Cheat Sheet

Here is a list of the most useful commands to interact with your Quantix node via the terminal.

## 👛 Wallet & Balance

### View your address (Public Key)
```bash
curl http://localhost:3001/address
```

### View Address Details (UTXOs)
Get the list of Unspent Transaction Outputs (UTXOs) for a specific address. This represents the "state" of the address on the blockchain.

```bash
curl http://localhost:3001/address/ADDRESS_PUBLIC_KEY
```

**Response Format:**
```json
{
  "unspentTxOuts": [
    {
      "txOutId": "TRANSACTION_ID",
      "txOutIndex": 0,
      "address": "ADDRESS_PUBLIC_KEY",
      "amount": 50
    }
  ]
}
```

### View your balance
Display the balance of the current node.
```bash
curl http://localhost:3001/balance
```

### View your UTXOs (Unspent Transaction Outputs)
Detail of the coins you own.
```bash
curl http://localhost:3001/myUnspentTransactionOutputs
```

---

## 💸 Transactions

### Send coins
Replace `RECIPIENT_ADDRESS` and `10` with the desired amount.
```bash
curl -H "Content-type:application/json" --data '{"address": "RECIPIENT_ADDRESS", "amount": 10}' http://localhost:3001/sendTransaction
```

### View a specific transaction
Get detailed information about a transaction by its ID (Hash).

```bash
curl http://localhost:3001/transaction/TRANSACTION_ID
```

**Response Format:**
```json
{
  "id": "TRANSACTION_ID",
  "txIns": [
    {
      "txOutId": "PREVIOUS_TRANSACTION_ID",
      "txOutIndex": 0,
      "signature": "SIGNATURE_STRING"
    }
  ],
  "txOuts": [
    {
      "address": "RECIPIENT_ADDRESS",
      "amount": 50
    }
  ]
}
```

### View the Transaction Pool (pending)
```bash
curl http://localhost:3001/transactionPool
```

---

## ⛓️ Blockchain & Blocks

### View the entire blockchain
⚠️ Can be very large if the chain is long.
```bash
curl http://localhost:3001/blocks
```

### View a specific block (by Hash)
```bash
curl http://localhost:3001/block/BLOCK_HASH
```

### View chain height (Number of blocks)
Uses `jq` to count items returned by `/blocks`.
```bash
# With jq (recommended)
curl -s http://localhost:3001/blocks | jq length

# Without jq (approximation with grep)
curl -s http://localhost:3001/blocks | grep -o "hash" | wc -l
```

### Mint a block (Manually)
Forces the node to try mining a block immediately.
```bash
curl -H "Content-type:application/json" --data '{}' http://localhost:3001/mintBlock
```

---

## 🌐 Network (P2P)

### View connected peers
Lists the IP addresses of other nodes you are connected to.
```bash
curl http://localhost:3001/peers
```

### Count the number of peers
```bash
curl -s http://localhost:3001/peers | jq length
```

### Add a peer manually
```bash
curl -H "Content-type:application/json" --data '{"peer": "ws://PEER_IP:6001"}' http://localhost:3001/addPeer
```

---

## 🔍 Blockchain Explorer API

These endpoints are optimized for building a blockchain explorer.

### Get Blocks (Pagination)
Retrieve a range of blocks (headers only, no transactions) for efficient display.

```bash
curl http://localhost:3001/blocks/START_INDEX/END_INDEX
```
Example: Get blocks 0 to 10
```bash
curl http://localhost:3001/blocks/0/10
```

### Get Block by Index (Height)
Retrieve full block details using its height index.

```bash
curl http://localhost:3001/block/index/BLOCK_INDEX
```

### Total Supply
Get the total number of coins currently in circulation.

```bash
curl http://localhost:3001/totalSupply
```

### Address Distribution (Rich List)
Get a list of all addresses and their current balances.

```bash
curl http://localhost:3001/addresses
```

---

## ⚙️ Administration

### Stop the node
```bash
curl -H "Content-type:application/json" --data '{}' http://localhost:3001/stop
```

---

## 🛠️ Advanced Commands / Utilities

### Monitor node status
Displays block height, number of peers, and balance every 2 seconds.
(Requires `watch`, `curl`, and `jq`)
```bash
watch -n 2 "echo 'Blocks:' \$(curl -s http://localhost:3001/blocks | jq length) && echo 'Peers:' \$(curl -s http://localhost:3001/peers | jq length) && echo 'Balance:' \$(curl -s http://localhost:3001/balance | jq .balance)"
```

### Check the balance of any address
Replace `ADDRESS` with the public key to check.
```bash
curl -s http://localhost:3001/address/ADDRESS | jq '[.unspentTxOuts[].amount] | add'
```

### Simulate a block with transaction (Special Minting)
Generates a block containing a specific transaction (useful for debug/tests).
```bash
curl -H "Content-type:application/json" --data '{"address": "RECIPIENT", "amount": 100}' http://localhost:3001/mintTransaction
```
