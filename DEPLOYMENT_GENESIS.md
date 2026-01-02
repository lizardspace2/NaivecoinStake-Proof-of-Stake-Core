# Deployment Guide: Genesis Node (Node 1)

This guide details how to deploy the **first node** (Genesis Node) of your NaivecoinStake network. This node is special because it contains the Genesis private key and starts the blockchain.

## 1. Creating the Virtual Machine (VM)

We will use **Google Cloud Platform (GCP)** for this guide, taking advantage of the Free Tier if possible.

1.  **Access the console**:
    *   Log in to the [Google Cloud Console](https://console.cloud.google.com/).
    *   Go to the **Compute Engine** > **VM instances** menu.
    *   Click the **Create Instance** button.

2.  **Basic Configuration**:
    *   **Name**: `naivecoin-node-1`
    *   **Region**: Choose a region eligible for the "Free Tier" (e.g., `us-central1` (Iowa), `us-west1` (Oregon) or `us-east1` (South Carolina)).
    *   **Zone**: Any zone within the region (e.g., `us-central1-a`).

3.  **Machine Configuration**:
    *   **Series**: `E2`
    *   **Machine type**: `e2-micro` (2 vCPU, 1 GB memory). This is sufficient for a small node and is part of the free tier (under conditions).

4.  **Boot Disk**:
    *   Click **Change** in the "Boot disk" section.
    *   **Operating System**: `Ubuntu`
    *   **Version**: `Ubuntu 22.04 LTS` (x86/64, amd64).
    *   **Disk type**: `Standard persistent disk`.
    *   **Size**: `30 GB` (The free tier includes up to 30 GB).
    *   Click **Select**.

5.  **Firewall**:
    *   In the "Firewall" section, check:
        *   [x] **Allow HTTP traffic**
        *   [x] **Allow HTTPS traffic**
    *   *Note: This sets up basic rules, we will open specific ports (3001/6001) in the next step.*

6.  **Network Interfaces (For a Stats IP - Recommended)**:
    *   Expand the **Advanced options** section (at the bottom of the page) > **Networking**.
    *   Go to the **Network interfaces** subsection.
    *   *Note: If you already see "Network", "Subnet" fields etc., skip to the next line.*
    *   Locate the **External IPv4 address** field (it likely says "Ephemeral").
    *   Click the dropdown menu and choose **Create IP address**.
        *   Name it (e.g., `ip-node-1`).
        *   Click **Reserve**.
    *   **Network Service Tier**: Leave on `Premium`.
    *   Click **Done** (if the button is present at the bottom of the network block).

7.  Click **Create** at the bottom of the page.

## 2. Opening Ports

You need to open ports **3001** (API) and **6001** (P2P).

### Via Cloud Shell
```bash
gcloud compute firewall-rules create allow-naivecoin-ports \
    --allow tcp:3001,tcp:6001 \
    --source-ranges 0.0.0.0/0 \
    --description="Allow API and P2P ports for NaivecoinStake"
```
*(Or via the web interface in "VPC Network > Firewall")*

## 3. Installation

Connect to your VM via **SSH** and run:

```bash
# 1. Update and prerequisites
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

# 3. Clone the repository
git clone https://github.com/lizardspace2/NaivecoinStake-Proof-of-Stake-Core.git
cd NaivecoinStake-Proof-of-Stake-Core
```

## 4. Genesis Configuration

The Genesis node needs the private key that controls the initial 100 million coins.

1.  **Import the key**: Transfer your `genesis_key.json` file (created locally) to the server.
    *   *SSH Web Tip*: "Upload file" button in the top right.
2.  **Place the key**:
    ```bash
    mv ~/genesis_key.json ~/NaivecoinStake-Proof-of-Stake-Core/
    ```

## 5. Launch

Use the `docker-compose.prod.yml` file (already included):

```bash
sudo docker compose -f docker-compose.prod.yml up -d --build
```

## 6. Verification

The blockchain should start. Verify via the API:
`http://EXTERNAL_IP:3001/blocks`

You should see block #0 (Genesis) with your funds.
