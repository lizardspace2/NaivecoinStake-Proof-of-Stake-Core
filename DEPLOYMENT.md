
# Guide de Déploiement : NaivecoinStake Node

Ce guide explique comment déployer un nœud de votre blockchain, avec un focus sur les solutions d'hébergement **gratuites** dans le cloud.

## Prérequis

- [Docker](https://docs.docker.com/get-docker/) installé sur votre machine ou serveur.
- Git pour cloner le dépôt.

## Option 1 : Déploiement Rapide avec Docker (Local ou Serveur)

La méthode la plus simple pour lancer un nœud est d'utiliser Docker Compose.

### 1. Construire et Lancer

```bash
docker-compose up -d
```

Cela lancera deux nœuds locaux (`node1` sur le port 3001/6001 et `node2` sur 3002/6002) qui sont connectés entre eux.

### 2. Personnalisation

Pour un déploiement sur un serveur unique (production), vous pouvez lancer un seul conteneur :

```bash
docker build -t naivechain .
docker run -d \
  -p 80:3001 \
  -p 6001:6001 \
  -v $(pwd)/wallet:/app/node/wallet \
  -e HTTP_PORT=3001 \
  -e P2P_PORT=6001 \
  -e PEERS=ws://IP_AUTRE_NODE:6001 \
  naivechain
```

- `-p 80:3001` : Rend l'API accessible sur le port 80 (HTTP).
- `-p 6001:6001` : Ouvre le port P2P pour communiquer avec d'autres nœuds.
- `-v ...` : Persiste votre portefeuille (clé privée) sur le serveur hôte.

---

## Option 2 : Hébergement Cloud Gratuit

Héberger une blockchain demande que le serveur tourne **24h/24**. Voici les meilleures options gratuites en 2024/2025.

### 1. Oracle Cloud "Always Free" (Recommandé)

C'est l'offre la plus généreuse pour un nœud blockchain car elle offre beaucoup de RAM et de CPU sur ARM (Ampere).

- **Ce qui est gratuit :** 
  - Jusqu'à 4 instances ARM (24 Go de RAM au total).
  - 2 instances AMD (1 Go RAM).
  - Adresse IP publique incluse.
- **Avantages :** Très puissant, parfait pour un nœud qui doit calculer/vérifier des blocs.
- **Inconvénients :** Inscription parfois complexe (carte bancaire requise pour vérification d'identité).

**Procédure :**
1. Créer un compte Oracle Cloud Free Tier.
2. Créer une instance de calcul (VM.Standard.A1.Flex).
3. Ouvrir les ports 3001 (API) et 6001 (P2P) dans la "Security List" du VCN.
4. Se connecter en SSH, installer Docker et cloner votre repo.
5. Lancer avec `docker-compose up -d`.

### 2. Google Cloud Platform (GCP) Free Tier

- **Ce qui est gratuit :**
  - Instance `e2-micro` (2 vCPU, 1 Go RAM).
  - 30 Go de disque.
- **Avantages :** Fiable, facile à utiliser.
- **Inconvénients :** Puissance limitée (CPU partagé), facturation du trafic réseau sortant au-delà de certaines limites (mais suffisant pour un petit nœud).

### 3. AWS Free Tier

- **Ce qui est gratuit :**
  - Instance `t2.micro` ou `t3.micro` (1 vCPU, 1 Go RAM) pendant **12 mois seulement**.
- **Avantages :** Standard de l'industrie.
- **Inconvénients :** Pas gratuit à vie (seulement 1 an).

---

## Conseils de Sécurité

1. **Pare-feu :** N'ouvrez que les ports nécessaires.
   - 3001 (HTTP) : Pour contrôler votre nœud ou utiliser un explorer. Vous pouvez le restreindre à votre IP si c'est juste pour vous.
   - 6001 (P2P) : Doit être ouvert à **tous** (0.0.0.0/0) pour que les autres nœuds puissent se synchroniser avec vous.
2. **Clés Privées :** 
   - Ne jamais commiter `genesis_key.json` ou vos fichiers de wallet (`node/wallet/*`).
   - Sauvegardez-les en local.
3. **HTTPS :** Si vous distribuez un wallet web qui se connecte au nœud, il faudra un certificat SSL (utilisez un reverse proxy comme Nginx + Let's Encrypt devant votre nœud).

## Distribuer des Tokens

Une fois votre nœud en ligne avec la clé Genesis :
1. Connectez-vous à l'API de votre nœud.
2. Utilisez `/sendTransaction` pour envoyer des tokens aux adresses de vos utilisateurs.
3. Vos utilisateurs peuvent ensuite lancer leur propre nœud et "Minter" (stake) avec ces tokens.
