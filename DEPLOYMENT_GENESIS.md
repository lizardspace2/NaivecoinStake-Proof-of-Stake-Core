# Guide de Déploiement : Nœud Genesis (Node 1)

Ce guide détaille comment déployer le **premier nœud** (Nœud Genesis) de votre réseau NaivecoinStake. Ce nœud est spécial car il contient la clé privée Genesis et démarre la blockchain.

## 1. Création de la Machine Virtuelle (VM)

1.  Connectez-vous à la [Console Google Cloud](https://console.cloud.google.com/).
2.  Allez dans **Compute Engine** > **Instances de VM**.
3.  Cliquez sur **Créer une instance**.
4.  **Configuration recommandée :**
    *   **Nom** : `naivecoin-node-1`
    *   **Région** : Choisissez une région proche de vous (ou `us-central1`, `us-west1` pour le Free Tier).
    *   **Type de machine** : `e2-micro` (2 vCPU, 1 Go de mémoire) suffit pour commencer.
    *   **Disque de démarrage** : **Ubuntu** (22.04 LTS ou 20.04 LTS), 30 Go.
5.  **Pare-feu (Firewall)** :
    *   Cochez "Autoriser le trafic HTTP".
    *   Cochez "Autoriser le trafic HTTPS".
6.  Cliquez sur **Créer**.

## 2. Ouverture des Ports

Il faut ouvrir les ports **3001** (API) et **6001** (P2P).

### Via Cloud Shell
```bash
gcloud compute firewall-rules create allow-naivecoin-ports \
    --allow tcp:3001,tcp:6001 \
    --source-ranges 0.0.0.0/0 \
    --description="Autoriser les ports API et P2P pour NaivecoinStake"
```
*(Ou via l'interface web dans "Réseau VPC > Pare-feu")*

## 3. Installation

Connectez-vous à votre VM en **SSH** et lancez :

```bash
# 1. Mise à jour et prérequis
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg lsb-release git nano

# 2. Docker
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# 3. Cloner le dépôt
git clone https://github.com/lizardspace2/NaivecoinStake-Proof-of-Stake-Core.git
cd NaivecoinStake-Proof-of-Stake-Core
```

## 4. Configuration Genesis

Le nœud Genesis a besoin de la clé privée qui contrôle les 100 millions de coins initiaux.

1.  **Importer la clé** : Transférez votre fichier `genesis_key.json` (créé localement) vers le serveur.
    *   *Astuce SSH Web* : Bouton "Importer un fichier" en haut à droite.
2.  **Placer la clé** :
    ```bash
    mv ~/genesis_key.json ~/NaivecoinStake-Proof-of-Stake-Core/
    ```

## 5. Lancement

Utilisez le fichier `docker-compose.prod.yml` (déjà inclus) :

```bash
sudo docker compose -f docker-compose.prod.yml up -d --build
```

## 6. Vérification

La blockchain doit démarrer. Vérifiez via l'API :
`http://IP_EXTERNE:3001/blocks`

Vous devriez voir le bloc #0 (Genesis) avec vos fonds.
