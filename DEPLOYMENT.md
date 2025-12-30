
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

### Alternative : Via Cloud Shell

Si vous préférez la ligne de commande, ouvrez le **Cloud Shell** (icône de terminal en haut à droite de la console) et lancez :

```bash
gcloud compute firewall-rules create allow-naivecoin-ports \
    --allow tcp:3001,tcp:6001 \
    --source-ranges 0.0.0.0/0 \
    --description="Autoriser les ports API et P2P pour NaivecoinStake"
```

## 3. Installation et Lancement du Nœud

1.  Retournez dans **Compute Engine** > **Instances de VM**.
2.  Cliquez sur le bouton **SSH** à côté de votre instance pour ouvrir un terminal dans votre navigateur.
3.  Exécutez les commandes suivantes une par une :

### A. Installer Docker et Git
```bash
# 1. Mettre à jour et installer les prérequis (dont 'nano' pour éditer les fichiers)
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg lsb-release git nano

# 2. Ajouter la clé GPG officielle de Docker
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg

# 3. Configurer le dépôt Docker
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# 4. Installer Docker Engine
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# 5. Vérifier que Docker fonctionne
sudo docker run hello-world
```

### B. Configurer et Lancer le Nœud

1.  **Cloner votre dépôt**
    (Remplacez URL_DU_REPO par l'URL de votre repo GitHub/GitLab)
    ```bash
    git clone https://github.com/lizardspace2/NaivecoinStake-Proof-of-Stake-Core.git
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
          # Monte le fichier local genesis_key.json vers l'emplacement attendu par le wallet
          - ./genesis_key.json:/app/node/wallet/private_key
    ```
    (Sauvegardez avec `Ctrl+O`, `Entrée`, puis `Ctrl+X`)

    > [!TIP]
    > **Rappel nano** : 
    > *   Pour sauvegarder : Appuyez sur **Ctrl + O**, puis **Entrée**.
    > *   Pour quitter : Appuyez sur **Ctrl + X**.

3.  **Configurer la Clé Genesis (Méthode recommandée : Importation)**
    Ne copiez-collez pas le texte, le fichier est trop gros et ferait planter le terminal. Utilisez l'outil d'importation.

    1.  Dans la fenêtre SSH (navigateur), cliquez sur le bouton **"Importer un fichier"** (Upload file) situé dans le menu en haut à droite (roue dentée ou icône "flèche vers le haut").
    2.  Sélectionnez votre fichier `genesis_key.json` sur votre ordinateur.
    3.  Une fois le transfert terminé, déplacez-le dans le dossier du projet :
    ```bash
    mv ~/genesis_key.json ~/NaivecoinStake-Proof-of-Stake-Core/
    ```
    (Si la commande échoue, faites `ls` pour voir où est le fichier).

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



## 6. Créer un réseau de test

### Option A : Sur la même machine (Recommandé pour test rapide)

Pour tester la blockchain avec plusieurs pairs sur **la même machine** (sans payer de VM supplémentaire), vous pouvez créer une configuration multi-nœuds.

1.  **Créer la configuration multi-nœuds**
    Créez un fichier `docker-compose.multi.yml` :
    ```bash
    nano docker-compose.multi.yml
    ```
    Collez le contenu suivant. Cela crée :
    *   **node1** : Votre nœud principal (Ports 3001/6001) avec la clé Genesis.
    *   **node2** : Un nouveau nœud vierge (Ports 3002/6002) qui se connecte au node1.

    ```yaml
    version: '3'
    services:
      node1:
        build: .
        container_name: naivecoin-node-1
        ports:
          - "3001:3001"
          - "6001:6001"
        environment:
          - HTTP_PORT=3001
          - P2P_PORT=6001
          - PEERS=
          - PRIVATE_KEY=node/wallet/private_key_1
        volumes:
          - ./genesis_key.json:/app/node/wallet/private_key_1

      node2:
        build: .
        container_name: naivecoin-node-2
        ports:
          - "3002:3002"
          - "6002:6002"
        environment:
          - HTTP_PORT=3002
          - P2P_PORT=6002
          - PEERS=ws://node1:6001
          - PRIVATE_KEY=node/wallet/private_key_2
        depends_on:
          - node1
    ```

2.  **Lancer le réseau**
    Il faut d'abord arrêter le nœud simple s'il tourne :
    ```bash
    sudo docker compose -f docker-compose.prod.yml down
    ```
    Puis lancer le multi-nœud :
    ```bash
    sudo docker compose -f docker-compose.multi.yml up -d --build
    ```

3.  **Vérification**
    *   **Node 1** : `http://IP_EXTERNE:3001/peers` (Doit montrer le node2 connecté)
    *   **Node 2** : `http://IP_EXTERNE:3002/blocks` (Doit se synchroniser et avoir le bloc Genesis)

    *Note : Si vous utilisez le pare-feu, assurez-vous d'ouvrir aussi les ports 3002 et 6002 si vous voulez y accéder depuis l'extérieur.*

### Option B : Sur une seconde machine virtuelle (Préférence Utilisateur)

Cette méthode est plus proche d'un réseau réel décentralisé.
*Attention : La deuxième VM peut engendrer des coûts si votre quota gratuit est dépassé.*

1.  **Créer la seconde VM (`naivecoin-node-2`)**
    *   Suivez l'étape 1 de ce guide pour créer une nouvelle instance.
    *   Appliquez la **même règle de pare-feu** (le tag `http-server` ou la règle `allow-naivecoin-ports` s'applique à tout le réseau si configurée sur `0.0.0.0/0`).

2.  **Installer le logiciel**
    *   Connectez-vous en SSH à `naivecoin-node-2`.
    *   Suivez l'étape 3.A pour installer Docker et Git.
    *   Clonez le dépôt (Step 3.B.1).

3.  **Configurer le Node 2**
    Le dépôt contient un fichier **déjà configuré** pour le réseau public : `docker-compose-peer.yml`.
    
    Grâce à la mise à jour "Bootnode", le nœud se connectera **automatiquement** au réseau principal sans aucune configuration d'IP.

    Vous n'avez **rien à faire** à cette étape !

4.  **Lancer le Node 2**
    ```bash
    sudo docker compose -f docker-compose-peer.yml up -d --build
    ```

5.  **Vérification**
    Consultez les logs pour voir la connexion :
    ```bash
    sudo docker compose -f docker-compose-peer.yml logs -f
    ```
    Vous devriez voir `connection to peer: ws://IP_NODE_1:6001`.

---

**Note** : L'IP externe d'une VM peut changer si vous l'arrêtez/redémarrez. Pour la production, il est conseillé de réserver une **Adresse IP statique externe** dans la section "Réseau VPC > Adresses IP" et de l'attacher à votre VM.
