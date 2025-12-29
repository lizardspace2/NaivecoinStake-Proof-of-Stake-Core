
# Guide de Déploiement : NaivecoinStake sur Google Cloud Platform (GCP)

Ce guide détaille étape par étape comment déployer votre nœud NaivecoinStake sur l'offre gratuite ("Free Tier") de Google Cloud Platform.

## 1. Création de la Machine Virtuelle (VM)

L'offre gratuite de GCP inclut une instance `e2-micro` dans certaines régions spécifiques.

1.  Connectez-vous à la [Console Google Cloud](https://console.cloud.google.com/).
2.  Allez dans **Compute Engine** > **Instances de VM**.
3.  Cliquez sur **Créer une instance**.
4.  **Configuration Importante (pour la gratuité) :**
    *   **Nom** : `naivecoin-node-1`
    *   **Région** : Choisissez `us-central1`, `us-west1` ou `us-east1` (Seules ces régions sont éligibles au Free Tier).
    *   **Type de machine** : `e2-micro` (2 vCPU, 1 Go de mémoire).
    *   **Disque de démarrage** : Cliquez sur "Modifier".
        *   Système d'exploitation : **Ubuntu** (Choisir la version `22.04 LTS` ou `20.04 LTS`).
        *   Type de disque : **Disque persistant standard** (Standard persistent disk).
        *   Taille : **30 Go** (Maximum inclus dans l'offre gratuite).
5.  **Pare-feu (Firewall)** :
    *   Cochez "Autoriser le trafic HTTP".
    *   Cochez "Autoriser le trafic HTTPS".
6.  Cliquez sur **Créer**.

## 2. Configuration du Pare-feu (Ouvrir les ports)

Par défaut, seuls les ports 80 (HTTP) et 443 (HTTPS) sont ouverts. Il faut ouvrir le port **3001** (API) et **6001** (P2P).

1.  Dans la console, cherchez "Règles de pare-feu" (Firewall policies) ou allez dans **Réseau VPC** > **Pare-feu**.
2.  Cliquez sur **Créer une règle de pare-feu**.
3.  **Nom** : `allow-naivecoin-ports`
4.  **Cibles** : `Toutes les instances du réseau`
5.  **Plage d'adresses IP source** : `0.0.0.0/0` (Autorise tout le monde).
6.  **Protocoles et ports** :
    *   Cochez `tcp` et entrez : `3001,6001`
7.  Cliquez sur **Créer**.

## 3. Installation et Lancement du Nœud

1.  Retournez dans **Compute Engine** > **Instances de VM**.
2.  Cliquez sur le bouton **SSH** à côté de votre instance pour ouvrir un terminal dans votre navigateur.
3.  Exécutez les commandes suivantes une par une :

### A. Installer Docker et Git
```bash
# Mettre à jour le système
sudo apt-get update

# Installer les prérequis
sudo apt-get install -y \
    ca-certificates \
    curl \
    gnupg \
    lsb-release \
    git

# Ajouter la clé GPG officielle de Docker
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg

# Configurer le dépôt Docker
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Installer Docker Engine
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Vérifier que Docker fonctionne
sudo docker run hello-world
```

### B. Configurer et Lancer le Nœud

1.  **Cloner votre dépôt**
    (Remplacez URL_DU_REPO par l'URL de votre repo GitHub/GitLab)
    ```bash
    git clone https://github.com/VOTRE_UTILISATEUR/NaivecoinStake-Proof-of-Stake-Core.git
    cd NaivecoinStake-Proof-of-Stake-Core
    ```

2.  **Créer la configuration de production**
    Créez un fichier `docker-compose.prod.yml` pour définir une installation propre à un seul nœud :
    ```bash
    nano docker-compose.prod.yml
    ```
    Collez le contenu suivant :
    ```yaml
    version: '3'
    services:
      node:
        build: .
        container_name: naivecoin-node
        restart: always
        ports:
          - "3001:3001"
          - "6001:6001"
        environment:
          - HTTP_PORT=3001
          - P2P_PORT=6001
          - PEERS=
          - PRIVATE_KEY=node/wallet/private_key
        volumes:
          - ./genesis_key.json:/app/node/wallet/private_key
    ```
    (Sauvegardez avec `Ctrl+O`, `Entrée`, puis `Ctrl+X`)

3.  **Configurer la Clé Genesis**
    Créez le fichier contenant votre clé privée (indispensable pour que le nœud soit reconnu comme celui possédant les coins du bloc Genesis) :
    ```bash
    nano genesis_key.json
    ```
    Collez le contenu de votre fichier `genesis_key.json` local.
    (Sauvegardez avec `Ctrl+O`, `Entrée`, puis `Ctrl+X`)

4.  **Lancer le nœud**
    Utilisez le fichier de configuration de production pour lancer le nœud :
    ```bash
    sudo docker compose -f docker-compose.prod.yml up -d --build
    ```

    *   `-f docker-compose.prod.yml` : Utilise notre configuration spécifique.
    *   `-d` : Mode "détaché" (tourne en arrière-plan).
    *   `--build` : Construit l'image Docker.

## 4. Vérification

Une fois lancé, vérifiez que tout fonctionne :

1.  Récupérez l'**IP Externe** de votre VM dans la console Google Cloud.
2.  Dans votre navigateur, allez sur : `http://IP_EXTERNE:3001/blocks`
3.  Vous devriez voir le bloc Genesis avec vos 100 millions de coins.

## 5. Maintenance et Logs

- **Voir les logs** :
  ```bash
  sudo docker compose -f docker-compose.prod.yml logs -f
  ```
- **Arrêter le nœud** :
  ```bash
  sudo docker compose -f docker-compose.prod.yml down
  ```
- **Mettre à jour le code** :
  ```bash
  git pull
  sudo docker compose -f docker-compose.prod.yml up -d --build
  ```

---

**Note** : L'IP externe d'une VM peut changer si vous l'arrêtez/redémarrez. Pour la production, il est conseillé de réserver une **Adresse IP statique externe** dans la section "Réseau VPC > Adresses IP" et de l'attacher à votre VM.
