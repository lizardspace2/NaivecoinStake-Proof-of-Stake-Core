# Protocole d'Indexation Blockchain vers Supabase

Ce document décrit la procédure complète pour extraire les données de votre nœud NaivecoinStake (via l'API locale) et les sauvegarder dans une base de données Supabase.

## 1. Configuration Supabase (Base de Données)

Connectez-vous à votre dashboard Supabase, allez dans l'éditeur **SQL** et exécutez le script suivant pour créer les tables nécessaires.

```sql
-- Table des blocs
CREATE TABLE IF NOT EXISTS blocks (
    index BIGINT PRIMARY KEY,
    hash TEXT UNIQUE NOT NULL,
    prev_hash TEXT NOT NULL,
    timestamp BIGINT NOT NULL,
    difficulty BIGINT NOT NULL,
    minter_address TEXT NOT NULL,
    minter_balance NUMERIC,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table des transactions
CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    block_index BIGINT REFERENCES blocks(index),
    timestamp BIGINT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table des entrées (Inputs) - Qui envoie l'argent
CREATE TABLE IF NOT EXISTS tx_inputs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    transaction_id TEXT REFERENCES transactions(id),
    tx_out_id TEXT, -- ID de la transaction d'origine
    tx_out_index INTEGER, -- Index de la sortie d'origine
    signature TEXT
);

-- Table des sorties (Outputs) - Qui reçoit l'argent
CREATE TABLE IF NOT EXISTS tx_outputs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    transaction_id TEXT REFERENCES transactions(id),
    index INTEGER NOT NULL,
    address TEXT NOT NULL,
    amount NUMERIC NOT NULL
);

-- Index pour la performance
CREATE INDEX idx_blocks_hash ON blocks(hash);
CREATE INDEX idx_tx_block_index ON transactions(block_index);
CREATE INDEX idx_tx_inputs_txid ON tx_inputs(transaction_id);
CREATE INDEX idx_tx_outputs_txid ON tx_outputs(transaction_id);
CREATE INDEX idx_tx_outputs_address ON tx_outputs(address); -- Pour chercher par adresse
```

## 2. Script d'Indexation (Node.js)

Créez un nouveau dossier (ex: `indexer`) et installez les dépendances :
```bash
npm init -y
npm install @supabase/supabase-js axios
```

Créez un fichier `index.js` avec le contenu suivant. Ce script va :
1.  Vérifier le dernier bloc connu dans la base de données.
2.  Demander le bloc suivant à votre nœud local.
3.  Insérer le bloc et ses transactions.
4.  Attendre et recommencer (synchronisation continue).

```javascript
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');

// --- CONFIGURATION ---
const SUPABASE_URL = 'VOTRE_SUPABASE_URL';
const SUPABASE_KEY = 'VOTRE_SUPABASE_SERVICE_ROLE_KEY'; // Utilisez la clé SERVICE_ROLE pour pouvoir écrire sans restriction
const NODE_URL = 'http://localhost:3001'; // URL de votre Explorer Node

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function getLastIndexedBlock() {
    const { data, error } = await supabase
        .from('blocks')
        .select('index')
        .order('index', { ascending: false })
        .limit(1);
    
    if (error) {
        console.error('Erreur Supabase:', error);
        return -1;
    }
    return data.length > 0 ? data[0].index : -1;
}

async function fetchBlock(index) {
    try {
        const response = await axios.get(`${NODE_URL}/block/index/${index}`);
        return response.data;
    } catch (e) {
        return null; 
    }
}

async function indexBlock(block) {
    console.log(`Indexation du bloc ${block.index}...`);
    
    // 1. Insérer le Bloc
    const { error: blockError } = await supabase.from('blocks').insert({
        index: block.index,
        hash: block.hash,
        prev_hash: block.previousHash,
        timestamp: block.timestamp,
        difficulty: block.difficulty,
        minter_address: block.minterAddress,
        minter_balance: block.minterBalance
    });

    if (blockError) throw blockError;

    // 2. Traiter les Transactions
    for (const tx of block.data) {
        // Insérer Transaction
        const { error: txError } = await supabase.from('transactions').insert({
            id: tx.id,
            block_index: block.index,
            timestamp: block.timestamp
        });
        if (txError) throw txError;

        // Insérer Inputs
        const inputs = tx.txIns.map(inn => ({
            transaction_id: tx.id,
            tx_out_id: inn.txOutId,
            tx_out_index: inn.txOutIndex,
            signature: inn.signature
        }));
        if (inputs.length > 0) {
            const { error: inError } = await supabase.from('tx_inputs').insert(inputs);
            if (inError) throw inError;
        }

        // Insérer Outputs
        const outputs = tx.txOuts.map((out, idx) => ({
            transaction_id: tx.id,
            index: idx,
            address: out.address,
            amount: out.amount
        }));
        if (outputs.length > 0) {
            const { error: outError } = await supabase.from('tx_outputs').insert(outputs);
            if (outError) throw outError;
        }
    }
    console.log(`Bloc ${block.index} indexé avec succès.`);
}

async function start() {
    console.log('Démarrage de l\'indexeur...');
    while (true) {
        try {
            const lastIndex = await getLastIndexedBlock();
            const nextIndex = lastIndex + 1;
            
            const block = await fetchBlock(nextIndex);
            
            if (block) {
                await indexBlock(block);
            } else {
                // Si pas de nouveau bloc, attendre 5 secondes
                await new Promise(r => setTimeout(r, 5000));
            }
        } catch (e) {
            console.error('Erreur critique:', e);
            await new Promise(r => setTimeout(r, 5000));
        }
    }
}

start();
```

## 3. Lancement

1.  Assurez-vous que votre nœud Explorer tourne (`docker-compose -f docker-compose.explorer.yml up`).
2.  Lancez le script d'indexation :
    ```bash
    node index.js
    ```

Le script va rattraper tout son retard (synchroniser toute la blockchain existante) puis restera en attente des nouveaux blocs pour les ajouter en temps réel.
