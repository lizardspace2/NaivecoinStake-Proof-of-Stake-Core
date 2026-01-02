
# Deployment Guide: NaivecoinStake on Google Cloud Platform (GCP)

This guide details step-by-step how to deploy your NaivecoinStake node on the Google Cloud Platform Free Tier.

## 1. Creating the Virtual Machine (VM)

The GCP Free Tier includes an `e2-micro` instance in specific regions.

1.  Log in to the [Google Cloud Console](https://console.cloud.google.com/).
2.  Go to **Compute Engine** > **VM instances**.
3.  Click on **Create Instance**.
4.  **Important Configuration (for free tier):**
    *   **Name**: `naivecoin-node-1`
    *   **Region**: Choose `us-central1`, `us-west1` or `us-east1` (Only these regions are eligible for the Free Tier).
    *   **Machine type**: `e2-micro` (2 vCPU, 1 GB memory).
    *   **Boot disk**: Click "Change".
        *   Operating System: **Ubuntu** (Choose version `22.04 LTS` or `20.04 LTS`).
        *   Disk type: **Standard persistent disk**.
        *   Size: **30 GB** (Maximum included in the free tier).
5.  **Firewall**:
    *   Check "Allow HTTP traffic".
    *   Check "Allow HTTPS traffic".
6.  Click **Create**.

## 2. Firewall Configuration (Opening Ports)

By default, only ports 80 (HTTP) and 443 (HTTPS) are open. You need to open port **3001** (API) and **6001** (P2P).

1.  In the console, search for "Firewall policies" or go to **VPC network** > **Firewall**.
2.  Click **Create Firewall Rule**.
3.  **Name**: `allow-naivecoin-ports`
4.  **Targets**: `All instances in the network`
5.  **Source IP ranges**: `0.0.0.0/0` (Allows everyone).
6.  **Protocols and ports**:
    *   Check `tcp` and enter: `3001,6001`
7.  Click **Create**.

### Alternative: Via Cloud Shell

If you prefer the command line, open the **Cloud Shell** (terminal icon at the top right of the console) and run:

```bash
gcloud compute firewall-rules create allow-naivecoin-ports \
    --allow tcp:3001,tcp:6001 \
    --source-ranges 0.0.0.0/0 \
    --description="Allow API and P2P ports for NaivecoinStake"
```

## 3. Node Installation and Launch

1.  Return to **Compute Engine** > **VM instances**.
2.  Click the **SSH** button next to your instance to open a terminal in your browser.
3.  Run the following commands one by one:

### A. Install Docker and Git
```bash
# 1. Update and install prerequisites (including 'nano' to edit files)
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg lsb-release git nano

# 2. Add Docker's official GPG key
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg

# 3. Configure the Docker repository
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# 4. Install Docker Engine
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# 5. Verify that Docker works
sudo docker run hello-world
```

### B. Configure and Launch the Node

1.  **Clone your repository**
    (Replace URL_OF_REPO with your GitHub/GitLab repo URL)
    ```bash
    git clone https://github.com/lizardspace2/NaivecoinStake-Proof-of-Stake-Core.git
    cd NaivecoinStake-Proof-of-Stake-Core
    ```

2.  **Production configuration**
    The `docker-compose.prod.yml` file is already included in the repository. It defines a single-node installation.

    You can check its content:
    ```bash
    cat docker-compose.prod.yml
    ```

3.  **Configure the Genesis Key (Recommended Method: Import)**
    Do not copy-paste the text, the file is too large and would crash the terminal. Use the import tool.

    1.  In the SSH window (browser), click the **"Upload file"** button located in the top right menu (gear or "up arrow" icon).
    2.  Select your `genesis_key.json` file on your computer.
    3.  Once the transfer is complete, move it to the project folder:
    ```bash
    mv ~/genesis_key.json ~/NaivecoinStake-Proof-of-Stake-Core/
    ```
    (If the command fails, do `ls` to see where the file is).

4.  **Launch the node**
    Use the production configuration file to launch the node:
    ```bash
    sudo docker compose -f docker-compose.prod.yml up -d --build
    ```

    *   `-f docker-compose.prod.yml`: Uses our specific configuration.
    *   `-d`: "Detached" mode (runs in the background).
    *   `--build`: Builds the Docker image.

## 4. Verification

Once launched, verify that everything is working:

1.  Get the **External IP** of your VM in the Google Cloud console.
2.  In your browser, go to: `http://EXTERNAL_IP:3001/blocks`
3.  You should see the Genesis block with your 100 million coins.

## 5. Maintenance and Logs

- **View logs**:
  ```bash
  sudo docker compose -f docker-compose.prod.yml logs -f
  ```
- **Stop the node**:
  ```bash
  sudo docker compose -f docker-compose.prod.yml down
  ```
- **Update the code**:
  ```bash
  git pull
  sudo docker compose -f docker-compose.prod.yml up -d --build
  ```

## 6. Create a Test Network

### Option A: On the same machine (Recommended for quick testing)

To test the blockchain with multiple peers on **the same machine** (without paying for an extra VM), you can create a multi-node configuration.

1.  **Create the multi-node configuration**
    Create a `docker-compose.multi.yml` file:
    ```bash
    nano docker-compose.multi.yml
    ```
    Paste the following content. This creates:
    *   **node1**: Your main node (Ports 3001/6001) with the Genesis key.
    *   **node2**: A new blank node (Ports 3002/6002) that connects to node1.

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

2.  **Launch the network**
    First, stop the single node if it's running:
    ```bash
    sudo docker compose -f docker-compose.prod.yml down
    ```
    Then launch the multi-node:
    ```bash
    sudo docker compose -f docker-compose.multi.yml up -d --build
    ```

3.  **Verification**
    *   **Node 1**: `http://EXTERNAL_IP:3001/peers` (Should show node2 connected)
    *   **Node 2**: `http://EXTERNAL_IP:3002/blocks` (Should sync and have the Genesis block)

    *Note: If you are using the firewall, make sure to also open ports 3002 and 6002 if you want to access them from outside.*

### Option B: On a second virtual machine (User Preference)

This method is closer to a real decentralized network.
*Warning: The second VM may incur costs if your free server quota is exceeded.*

1.  **Create the second VM (`naivecoin-node-2`)**
    *   Follow step 1 of this guide to create a new instance.
    *   Apply the **same firewall rule** (the `http-server` tag or `allow-naivecoin-ports` rule applies to the entire network if configured on `0.0.0.0/0`).

2.  **Install the software**
    *   SSH into `naivecoin-node-2`.
    *   Follow step 3.A to install Docker and Git.
    *   Clone the repository (Step 3.B.1).

3.  **Configure Node 2**
    The repository contains a file **already configured** for the public network: `docker-compose-peer.yml`.
    
    Thanks to the "Bootnode" update, the node will **automatically** connect to the main network without any IP configuration.

    You have **nothing to do** at this step!

4.  **Launch Node 2**
    ```bash
    sudo docker compose -f docker-compose-peer.yml up -d --build
    ```

5.  **Verification**
    Check the logs to see the connection:
    ```bash
    sudo docker compose -f docker-compose-peer.yml logs -f
    ```
    You should see `connection to peer: ws://NODE_1_IP:6001`.

---

**Note**: The external IP of a VM can change if you stop/restart it. For production, it is advisable to reserve a **Static External IP Address** in the "VPC Network > IP Addresses" section and attach it to your VM.
