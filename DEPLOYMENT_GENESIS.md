# Guide de Déploiement : Nœud Genesis (Node 1)

Ce guide détaille comment déployer le **premier nœud** (Nœud Genesis) de votre réseau NaivecoinStake. Ce nœud est spécial car il contient la clé privée Genesis et démarre la blockchain.

## 1. Création de la Machine Virtuelle (VM)

Nous utiliserons **Google Cloud Platform (GCP)** pour ce guide, en profitant de l'offre gratuite (Free Tier) si possible.

1.  **Accéder à la console** :
    *   Connectez-vous à la [Console Google Cloud](https://console.cloud.google.com/).
    *   Allez dans le menu **Compute Engine** > **Instances de VM**.
    *   Cliquez sur le bouton **Créer une instance**.

2.  **Configuration de base** :
    *   **Nom** : `naivecoin-node-1`
    *   **Région** : Choisissez une région éligible au "Free Tier" (ex: `us-central1` (Iowa), `us-west1` (Oregon) ou `us-east1` (South Carolina)).
    *   **Zone** : N'importe quelle zone dans la région (ex: `us-central1-a`).

3.  **Configuration de la machine** :
    *   **Série** : `E2`
    *   **Type de machine** : `e2-micro` (2 vCPU, 1 Go de mémoire). C'est suffisant pour un petit nœud et fait partie de l'offre gratuite (sous conditions).

4.  **Disque de démarrage (Boot Disk)** :
    *   Cliquez sur **Modifier** dans la section "Disque de démarrage".
    *   **Système d'exploitation** : `Ubuntu`
    *   **Version** : `Ubuntu 22.04 LTS` (x86/64, amd64).
    *   **Type de disque** : `Disque persistant standard`.
    *   **Taille** : `30 Go` (L'offre gratuite inclut jusqu'à 30 Go).
    *   Cliquez sur **Sélectionner**.

5.  **Pare-feu (Firewall)** :
    *   Dans la section "Pare-feu", cochez :
        *   [x] **Autoriser le trafic HTTP**
        *   [x] **Autoriser le trafic HTTPS**
    *   *Note : Cela configure les règles de base, nous ouvrirons les ports spécifiques (3001/6001) à l'étape suivante.*

6.  **Networking (Optionnel mais recommandé - IP Fixe)** :
    *   Dépliez **Options avancées** > **Mise en réseau**.
    *   Sous **Interfaces réseau**, cliquez sur la flèche pour modifier l'interface par défaut.
    *   Sous **Adresse IPv4 externe**, choisissez **Créer une adresse IP**. Donnez-lui un nom (ex: `ipv4-node-1`) et réservez-la. Cela évite que l'IP change au redémarrage.

7.  Cliquez sur **Créer** en bas de page.

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
