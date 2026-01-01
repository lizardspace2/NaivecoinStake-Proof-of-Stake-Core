# NaivecoinStake API Cheat Sheet

Voici une liste des commandes les plus utiles pour interagir avec votre nœud NaivecoinStake via le terminal.

## 👛 Portefeuille & Balance

### Voir votre adresse (Clé Publique)
```bash
curl http://localhost:3001/address
```

### Voir votre solde (Balance)
Afficher le solde du nœud courant.
```bash
curl http://localhost:3001/balance
```

### Voir vos UTXO (Unspent Transaction Outputs)
Détail des pièces que vous possédez.
```bash
curl http://localhost:3001/myUnspentTransactionOutputs
```

---

## 💸 Transactions

### Envoyer des coins
Remplacer `ADRESSE_DESTINATAIRE` et `10` par le montant voulu.
```bash
curl -H "Content-type:application/json" --data '{"address": "ADRESSE_DESTINATAIRE", "amount": 10}' http://localhost:3001/sendTransaction
```

### Voir une transaction spécifique
```bash
curl http://localhost:3001/transaction/ID_TRANSACTION
```

### Voir la Pool de transactions (en attente)
```bash
curl http://localhost:3001/transactionPool
```

---

## ⛓️ Blockchain & Blocs

### Voir toute la blockchain
⚠️ Peut être très lourd si la chaîne est longue.
```bash
curl http://localhost:3001/blocks
```

### Voir un bloc spécifique (par Hash)
```bash
curl http://localhost:3001/block/HASH_DU_BLOC
```

### Miner un bloc (Manuellement)
Force le nœud à essayer de miner un bloc immédiatement.
```bash
curl -H "Content-type:application/json" --data '{}' http://localhost:3001/mintBlock
```

---

## 🌐 Réseau (P2P)

### Voir les pairs connectés
Liste les adresses IP des autres nœuds auxquels vous êtes connecté.
```bash
curl http://localhost:3001/peers
```

### Ajouter un pair manuellement
```bash
curl -H "Content-type:application/json" --data '{"peer": "ws://IP_DU_PEER:6001"}' http://localhost:3001/addPeer
```

---

## ⚙️ Administration

### Arrêter le nœud (Stop)
```bash
curl -H "Content-type:application/json" --data '{}' http://localhost:3001/stop
```
