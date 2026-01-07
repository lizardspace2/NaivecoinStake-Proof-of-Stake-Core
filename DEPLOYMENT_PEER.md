# Deployment Guide: Peer Nodes

This guide explains how to add additional nodes (Node 2, Node 3, etc.) to your network to decentralize it.

## 1. Creating the Virtual Machine

To create a new node (peer), we will create a new VM instance on Google Cloud Platform (GCP).

1.  **Access the console**:
    *   Go to **Compute Engine** > **VM instances**.
    *   Click **Create Instance**.

2.  **Basic Configuration**:
    *   **Name**: `quantix-node-2` (or node-3, etc.)
    *   **Region**: You can choose the same region as Node 1 or a different one for more decentralization (e.g., `us-central1` if Node 1 is in `us-west1`).
    *   **Machine type**: `e2-micro` (Part of the free tier).

3.  **Boot Disk**:
    *   **Operating System**: `Ubuntu`
    *   **Version**: `Ubuntu 22.04 LTS` (x86/64, amd64).
    *   **Size**: `30 GB` (Standard persistent disk).

4.  **Firewall**:
    *   [x] Allow HTTP traffic
    *   [x] Allow HTTPS traffic

5.  **Network Interfaces (For a Static IP - Recommended)**:
    *   Expand the **Advanced options** section (at the bottom of the page) > **Networking**.
    *   Go to the **Network interfaces** subsection.
    *   *Note: If you already see "Network", "Subnet" fields etc., skip to the next line.*
    *   Locate the **External IPv4 address** field (it likely says "Ephemeral").
    *   Click the dropdown menu and choose **Create IP address**.
        *   Name it (e.g., `ip-node-2`).
        *   Click **Reserve**.
    *   **Network Service Tier**: Leave on `Premium`.
    *   Click **Done** (if the button is present at the bottom of the network block).

6.  Click **Create**.

*Note: If you are using the same GCP project as Node 1, the firewall rule opening ports 3001/6001 is already active for the entire network, so you don't need to recreate it.*

## 2. Installation

Connect via **SSH** and install Docker and the project:

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

## 3. Configuration and Launch

Peer nodes do **not** need the Genesis key. They will generate their own wallet automatically.

The `docker-compose-peer.yml` file is pre-configured to:
1.  Launch the node on ports 3001/6001.
2.  Connect automatically to the network (via the public Bootnode or by discovering peers).

**Launch the node:**

```bash
sudo docker compose -f docker-compose-peer.yml up -d --build
```

> **Note**: The node automatically connects to the public Bootnode. You do not need to modify the `PEERS` configuration unless you want to connect to a specific private network.

## 4. Verification

Verify that the node is syncing:

1.  **Logs**:
    ```bash
    sudo docker compose -f docker-compose-peer.yml logs -f
    ```
    Look for `connection to peer`.

2.  **API**:
    Go to `http://NODE_2_IP:3001/blocks`.
    You should see the same blocks as on Node 1.
