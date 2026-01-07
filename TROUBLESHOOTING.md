# Troubleshooting Guide: Quantix (QTX)

## Node Synchronization Issues

If a peer node (e.g., Node 3) is connected but not synchronizing with the main node, follow these steps to diagnose and fix the issue.

### 1. Check Connectivity
Ensure the nodes are connected.
```bash
curl -s http://localhost:3001/peers
```
If the list is empty, add the peer manually using your deployment guide.

### 2. Check for a Chain Fork
If the running node is stuck at a specific block height (e.g., 314) while the main node is ahead, check if they are on the same chain. Compare the hash of the last block the stuck node possesses.

**Get the last block index from the stuck node:**
```bash
curl -s http://localhost:3001/blocks | jq length
# Example output: 314 (This means it has blocks 0 to 313)
```

**Compare the hash of the last block (index 313) on BOTH nodes:**

On the **Stuck Node**:
```bash
curl -s http://localhost:3001/blocks | jq '.[313].hash'
```

On the **Healthy Node**:
```bash
curl -s http://localhost:3001/blocks | jq '.[313].hash'
```

*   **If hashes are DIFFERENT**: The node is on a fork. You must reset it.
    *   Stop the container: `sudo docker stop quantix-node`
    *   Remove the data directory (or volume).
    *   Restart the container to resync from scratch.

*   **If hashes are IDENTICAL**: The node is just stuck (handshake missed). Proceed to step 3.

### 3. Force Synchronization (Restart)
If the hashes match, restarting the node will force a new handshake and trigger synchronization immediately.

**Identify the container name:**
```bash
sudo docker ps
```

**Restart the container:**
```bash
sudo docker restart <container_name>
# Example: sudo docker restart quantix-node
```

Wait 10-15 seconds and check if the block count increases:
```bash
curl -s http://localhost:3001/blocks | jq length
```
