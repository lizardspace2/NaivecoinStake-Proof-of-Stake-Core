# Guide de Déploiement : Nœuds Pairs (Peer Nodes)

Ce guide explique comment ajouter des nœuds supplémentaires (Node 2, Node 3, etc.) à votre réseau pour le décentraliser.

## 1. Création de la Machine Virtuelle
 
Pour créer un nouveau nœud (pair), nous allons créer une nouvelle instance VM sur Google Cloud Platform (GCP).
 
1.  **Accéder à la console** :
    *   Allez dans **Compute Engine** > **Instances de VM**.
    *   Cliquez sur **Créer une instance**.
 
2.  **Configuration de base** :
    *   **Nom** : `naivecoin-node-2` (ou node-3, etc.)
    *   **Région** : Vous pouvez choisir la même région que le nœud 1 ou une différente pour plus de décentralisation (ex: `us-central1` si le nœud 1 est en `us-west1`).
    *   **Type de machine** : `e2-micro` (Fait partie de l'offre gratuite).
 
3.  **Disque de démarrage** :
    *   **Système d'exploitation** : `Ubuntu`
    *   **Version** : `Ubuntu 22.04 LTS` (x86/64, amd64).
    *   **Taille** : `30 Go` (Disque persistant standard).
 
4.  **Pare-feu (Firewall)** :
    *   [x] Autoriser le trafic HTTP
    *   [x] Autoriser le trafic HTTPS
 
5.  **Networking (Optionnel - IP Fixe)** :
    *   Comme pour le premier nœud, il est recommandé de réserver une IP statique.
    *   **Options avancées** > **Mise en réseau** > **Interfaces réseau**.
    *   **Adresse IPv4 externe** > **Créer une adresse IP** (ex: `ipv4-node-2`).
 
6.  Cliquez sur **Créer**.
 
*Note : Si vous utilisez le même projet GCP que le nœud 1, la règle de pare-feu ouvrant les ports 3001/6001 est déjà active pour tout le réseau, donc vous n'avez pas besoin de la recréer.*

## 2. Installation

Connectez-vous en **SSH** et installez Docker et le projet :

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

## 3. Configuration et Lancement

Les nœuds pairs n'ont **pas** besoin de la clé Genesis. Ils généreront leur propre portefeuille automatiquement.

Le fichier `docker-compose-peer.yml` est pré-configuré pour :
1.  Lancer le nœud sur les ports 3001/6001.
2.  Se connecter automatiquement au réseau (via le Bootnode public ou en découvrant les pairs).

**Lancer le nœud :**

```bash
sudo docker compose -f docker-compose-peer.yml up -d --build
```

> **Note** : Le nœud se connecte automatiquement au Bootnode public. Vous n'avez pas besoin de modifier la configuration `PEERS` sauf si vous souhaitez vous connecter à un réseau privé spécifique.

## 4. Vérification

Vérifiez que le nœud se synchronise :

1.  **Logs** :
    ```bash
    sudo docker compose -f docker-compose-peer.yml logs -f
    ```
    Recherchez `connection to peer`.

2.  **API** :
    Allez sur `http://IP_NODE_2:3001/blocks`.
    Vous devriez voir les mêmes blocs que sur le Nœud 1.
