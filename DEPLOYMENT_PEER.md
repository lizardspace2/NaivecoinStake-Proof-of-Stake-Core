# Guide de Déploiement : Nœuds Pairs (Peer Nodes)

Ce guide explique comment ajouter des nœuds supplémentaires (Node 2, Node 3, etc.) à votre réseau pour le décentraliser.

## 1. Création de la Machine Virtuelle

Répétez la création d'une VM standard (comme pour le nœud 1) :
*   **OS** : Ubuntu 22.04 LTS
*   **Nom suggéré** : `naivecoin-node-2`
*   **Firewall** : Assurez-vous que les ports **3001** et **6001** sont ouverts (la même règle de pare-feu que pour le nœud 1 s'applique si vous êtes dans le même projet/réseau).

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

> **Note** : Si vous n'utilisez pas de Bootnode codé en dur, vous devrez peut-être éditer `docker-compose-peer.yml` pour ajouter l'IP du Node 1 dans la variable `PEERS` : `PEERS=ws://IP_NODE_1:6001`.

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
