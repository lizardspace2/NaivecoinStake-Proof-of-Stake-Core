# Protocole d'Indexation Blockchain vers Supabase

Ce document décrit la procédure complète pour extraire les données de votre nœud Dilithium (via l'API locale) et les sauvegarder dans une base de données Supabase.

Il couvre :
1.  La configuration de la Base de Données (Schema).
2.  L'importation de masse (pour l'historique initial).
3.  La synchronisation continue (pour le temps réel).
4.  Le Prompt Technique pour générer la Webapp.

---

## 1. Configuration Supabase (Base de Données)

Connectez-vous à votre dashboard Supabase, allez dans l'éditeur **SQL** et exécutez le script suivant.

```sql
-- Nettoyage (Optionnel, attention aux données existantes)
-- DROP TABLE IF EXISTS tx_inputs, tx_outputs, transactions, blocks;

-- 1. Table des blocs
CREATE TABLE IF NOT EXISTS blocks (
    index BIGINT PRIMARY KEY,
    hash TEXT UNIQUE NOT NULL,
    prev_hash TEXT NOT NULL,
    timestamp BIGINT NOT NULL,
    difficulty BIGINT NOT NULL,
    minter_address TEXT NOT NULL,
    minter_balance NUMERIC,
    transaction_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Table des transactions
CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    block_index BIGINT REFERENCES blocks(index) ON DELETE CASCADE,
    timestamp BIGINT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Table des entrées (Inputs)
CREATE TABLE IF NOT EXISTS tx_inputs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    transaction_id TEXT REFERENCES transactions(id) ON DELETE CASCADE,
    tx_out_id TEXT, -- ID de la transaction d'origine
    tx_out_index INTEGER, -- Index de la sortie d'origine
    signature TEXT
);

-- 4. Table des sorties (Outputs)
CREATE TABLE IF NOT EXISTS tx_outputs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    transaction_id TEXT REFERENCES transactions(id) ON DELETE CASCADE,
    index INTEGER NOT NULL,
    address TEXT NOT NULL,
    amount NUMERIC NOT NULL
);

-- 5. Index pour la performance
CREATE INDEX IF NOT EXISTS idx_blocks_hash ON blocks(hash);
CREATE INDEX IF NOT EXISTS idx_blocks_minter ON blocks(minter_address);
CREATE INDEX IF NOT EXISTS idx_tx_block_index ON transactions(block_index);
CREATE INDEX IF NOT EXISTS idx_tx_inputs_txid ON tx_inputs(transaction_id);
CREATE INDEX IF NOT EXISTS idx_tx_outputs_txid ON tx_outputs(transaction_id);
CREATE INDEX IF NOT EXISTS idx_tx_outputs_address ON tx_outputs(address);
```

---

## 2. Importation de Masse (Bulk Import)

Pour importer rapidement toute la chaîne existante (qui peut être lourde), utilisez ce script optimisé. Il télécharge la chaîne complète et l'insère par lots (batches) pour éviter de saturer Supabase.

1.  Créez un dossier `indexer` (si ce n'est pas fait).
2.  Installez les dépendances : `npm install @supabase/supabase-js axios`
3.  Créez le fichier `bulk_import.js` :

```javascript
/* bulk_import.js */
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');

// --- CONFIGURATION ---
const SUPABASE_URL = 'VOTRE_SUPABASE_URL_ICI';
const SUPABASE_KEY = 'VOTRE_SERVICE_ROLE_KEY_ICI'; // Clé secrète (backend)
const NODE_URL = 'http://localhost:3001';
const BATCH_SIZE = 50; // Nombre de blocs par envoi (ajuster selon limites)

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false }
});

async function run() {
    console.time('Importation');
    console.log('📡 Téléchargement de la blockchain complète depuis le nœud...');
    
    try {
        // Attention : Si la chaîne est > 100MB, il faut utiliser un stream. 
        // Pour l'instant, on assume que ça tient en mémoire (< 500k blocs).
        const { data: allBlocks } = await axios.get(`${NODE_URL}/blocks`);
        console.log(`✅ ${allBlocks.length} blocs récupérés. Début de l'indexation...`);

        // Trier par index croissant pour être propre
        allBlocks.sort((a, b) => a.index - b.index);

        for (let i = 0; i < allBlocks.length; i += BATCH_SIZE) {
            const batch = allBlocks.slice(i, i + BATCH_SIZE);
            await processBatch(batch);
            const progress = Math.round(((i + batch.length) / allBlocks.length) * 100);
            process.stdout.write(`\r🚀 Progression : ${progress}% (${i + batch.length}/${allBlocks.length})`);
        }
        
        console.log('\n✨ Importation terminée avec succès !');
        console.timeEnd('Importation');

    } catch (err) {
        console.error('\n❌ Erreur fatale:', err.message);
        if (err.response) console.error('Détails:', err.response.statusText);
    }
}

async function processBatch(blocks) {
    const blockRows = [];
    const txRows = [];
    const inputRows = [];
    const outputRows = [];

    for (const block of blocks) {
        // Préparer Bloc
        blockRows.push({
            index: block.index,
            hash: block.hash,
            prev_hash: block.previousHash,
            timestamp: block.timestamp,
            difficulty: block.difficulty,
            minter_address: block.minterAddress,
            minter_balance: block.minterBalance,
            transaction_count: block.data.length
        });

        // Préparer Transactions
        for (const tx of block.data) {
            txRows.push({
                id: tx.id,
                block_index: block.index,
                timestamp: block.timestamp
            });

            // Inputs
            tx.txIns.forEach(inn => {
                inputRows.push({
                    transaction_id: tx.id,
                    tx_out_id: inn.txOutId,
                    tx_out_index: inn.txOutIndex,
                    signature: inn.signature
                });
            });

            // Outputs
            tx.txOuts.forEach((out, idx) => {
                outputRows.push({
                    transaction_id: tx.id,
                    index: idx,
                    address: out.address,
                    amount: out.amount
                });
            });
        }
    }

    // Insérer en base (upsert pour éviter les erreurs de doublons si on relance)
    const { error: errB } = await supabase.from('blocks').upsert(blockRows, { ignoreDuplicates: true });
    if (errB) throw new Error(`Erreur Blocs: ${errB.message}`);

    if (txRows.length > 0) {
        const { error: errT } = await supabase.from('transactions').upsert(txRows, { ignoreDuplicates: true });
        if (errT) throw new Error(`Erreur TXs: ${errT.message}`);
    }

    // Pour Inputs/Outputs, pas d'ID unique stable facile à générer dans le script, 
    // donc on insert simplement. Idéalement on vide les tables avant un full import.
    if (inputRows.length > 0) {
        const { error: errI } = await supabase.from('tx_inputs').insert(inputRows);
        if (errI) console.warn('Warn Inputs:', errI.message); // On log juste car duplicata possible sur UUID
    }
    if (outputRows.length > 0) {
        const { error: errO } = await supabase.from('tx_outputs').insert(outputRows);
        if (errO) console.warn('Warn Outputs:', errO.message);
    }
}

run();
```

---

## 3. Synchronisation Continue (Live Sync)

Utilisez ce script pour écouter et ajouter les nouveaux blocs au fur et à mesure.
Créez `live_indexer.js` :

```javascript
/* live_indexer.js */
// Reprendre le code du document original (index.js) mais pointez sur les bonnes tables
// et assurez-vous d'utiliser upsert() ou de gérer les erreurs "Duplicate key".
// ... (Voir SUPABASE_INDEXER_PROTOCOL.md original pour la base, ajusté avec les champs ci-dessus)
```

*(Note: Le script original fourni précédemment est valide, pensez juste à ajouter `transaction_count` dans l'insert de la table `blocks` si vous l'avez ajouté au schéma).*

---

## 4. Prompt Technique pour la Webapp (Explorer)

Copiez-collez le prompt ci-dessous dans votre outil d'IA ou envoyez-le à un développeur pour générer l'application web.

---

### **Prompt Technique Détaillé : "The Dilithium Nexus Explorer"**

**Contexte :**
Vous êtes l'Architecte Frontend Principal d'une blockchain de nouvelle génération. Vous devez construire l'interface "Flagship" qui servira de vitrine technologique. L'application doit être à la fois un outil d'analyse précis et une expérience visuelle immersive.

---

#### 1. Stack Technique & Architecture

*   **Core :** Next.js 14 (App Router) en mode `Strict`.
*   **Langage :** TypeScript. Utilisation exhaustive des types (pas de `any`).
*   **Data Layer :**
    *   **Supabase Client :** Pour le fetching de données (Server Components pour le SSR, Client Components pour l'interactivité).
    *   **Supabase Realtime :** Souscription aux `INSERT` sur la table `blocks` pour mettre à jour l'UI sans rechargement.
*   **Styling (Critique) :**
    *   **CSS Vanilla pur (CSS Modules recommandés)**.
    *   Pas de framework CSS (Tailwind, Bootstrap interdit).
    *   Usage intensif de **CSS Variables** pour le theming (`--color-neon: #00f3ff;`, `--bg-deep: #050510;`).
    *   **Glassmorphism** : `backdrop-filter: blur(12px);` et bordures semi-transparentes (`rgba(255,255,255,0.05)`).
*   **State Management :** `SWR` ou `React Query` pour la gestion du cache et le revalidation automatique côté client.

#### 2. Design System & UX (Sensation "Premium")

*   **Palette de Couleurs :**
    *   Background : `#030308` (Obsidian Black) à `#0a0a1a` (Deep Space Blue) en gradient radial subtil.
    *   Primary Accent : `#00f3ff` (Cyan Cyberpunk) pour les éléments actifs/liens.
    *   Secondary Accent : `#bc13fe` (Electric Purple) pour les gradients décoratifs.
    *   Text : `#e0e0e0` (Off-white) pour la lisibilité, `#a0a0b0` pour les métadonnées.
*   **Typographie :**
    *   Titres : *Inter* ou *Space Grotesk* (Bold).
    *   Données (Hash, Adresses) : *JetBrains Mono* ou *Fira Code* (Monospace obligatoires pour l'alignement).
*   **Composants Clés :**
    *   **`HashBadge`** : Un composant qui affiche le début et la fin d'un hash (ex: `a1b2...c3d4`) avec un bouton "Copier" au survol qui fait briller le hash.
    *   **`StatusOrb`** : Une petite orbe pulsante (verte/rouge) indiquant l'état du réseau ou d'une transaction.
    *   **`GlassCard`** : Conteneur principal avec fond noir à 40% d'opacité, flou 10px, bordure fine grise.

#### 3. Fonctionnalités Détaillées par Page

**A. Dashboard (`/`) - "Le Centre de Contrôle"**
*   **Stats Grid :** 4 cartes en haut.
    *   *Hauteur de Bloc* (Animation compteur incrémental).
    *   *Difficulté Réseau* (Formatée lisiblement).
    *   *Transactions (24h)*.
    *   *Supply* (Avec le symbole DIL).
*   **Live Feeds (Split View) :**
    *   Gauche : **Derniers Blocs**. Chaque rangée apparaît avec une animation `slide-in` douce quand un nouveau bloc est miné (via Supabase Realtime).
    *   Droite : **Dernières Transactions**. Affiche l'ID tronqué, le montant (en vert) et le temps relatif ("il y a 5s").

**B. Recherche Intelligente (Global Search)**
*   Une barre de recherche persistante dans le Header (`ctrl+k` pour activer).
*   **Logique de détection automatique :**
    *   Si entrée = entier -> Redirige vers `/block/[index]`.
    *   Si longueur = 64 cars -> Détermine si c'est un Bloc ou une Transaction (requête DB rapide) -> Redirection.
    *   Si format adresse -> Redirige vers `/address/[id]`.
*   Feedback visuel immédiat si l'entrée est invalide.

**C. Vue Bloc (`/block/[id]`)**
*   **Header :** Numéro du bloc en gros (H1) avec navigation Précédent/Suivant (< >).
*   **Métadonnées :** Hash (copiable), Parent Hash (lien), Minter, Date (Absolue + Relative).
*   **Liste des Transactions :** Tableau propre. Colonnes : ID, From (inputs count), To (outputs count), Valeur Totale.

**D. Vue Adresse (`/address/[id]`)**
*   **Wallet Card :** Affiche l'adresse avec un QR Code généré à la volée.
*   **Portfolio :** Solde Total affiché en gros chiffres.
*   **Historique :** Liste des transactions où cette adresse est présente (soit dans `tx_inputs` soit dans `tx_outputs`).
    *   *Challenge technique :* Utiliser une requête SQL optimisée ou une Vue SQL Supabase pour agréger ces données performantes.

#### 4. Instructions d'Implémentation Spécifiques

**Structure des Fichiers Suggérée :**
```text
/app
  /layout.tsx       # Shell principal + Font configuration
  /page.tsx         # Dashboard
  /block/[id]/page.tsx
  /tx/[id]/page.tsx
  /address/[id]/page.tsx
/components
  /ui               # Atails primitifs (Badge, Button, Card)
  /blockchain       # Composants métier (BlockList, TxFeed)
/lib
  supabase.ts       # Singleton client
  utils.ts          # Formatters (currency, date, hash shorten)
/types
  database.types.ts # Généré depuis Supabase CLI
```

**Exemple de flux de données (Dashboard) :**
1.  `page.tsx` (Server Component) charge les 10 derniers blocs via `await supabase.from('blocks')...`.
2.  Passe les données initiales à `<LiveBlockFeed initialData={blocks} />`.
3.  `<LiveBlockFeed />` (Client Component) affiche les données.
4.  Au `useEffect`, il souscrit à `supabase.channel('public:blocks').on(...)`.
5.  À chaque event `INSERT`, il ajoute le nouveau bloc en haut de la liste et supprime le dernier pour garder la liste fluide.

---
