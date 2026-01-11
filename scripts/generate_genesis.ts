
import { ml_dsa65 } from '../src/noble/ml-dsa';
import * as fs from 'fs';
import * as path from 'path';

// Helper to convert Uint8Array to Hex string
const buf2hex = (buffer: Uint8Array): string => {
    return Array.from(buffer)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
};

const generate = () => {
    try {
        console.log('Generating ml-dsa65 (Dilithium3) keypair...');

        // Generate random seed (32 bytes)
        const seed = crypto.getRandomValues(new Uint8Array(32));

        // Keygen from seed
        const keys = ml_dsa65.keygen(seed);

        const publicKeyHex = buf2hex(keys.publicKey);
        const seedHex = buf2hex(seed);

        // We only save the seed (private key) as the node expects 
        // a 64-char hex string (32 bytes) in node/wallet/private_key
        // However, the user request says 'genesis_key.json'.
        // Let's see what the original `generate_genesis_keys.ts` did.
        // It saved an object { publicKey, privateKey }.
        // But `wallet.ts` reads `node/wallet/private_key` as a raw string and 
        // checks if length is 64 hex chars (32 bytes).

        // So for the user's local file `genesis_key.json`, we should probably 
        // save the raw seed string so they can just rename it or move it 
        // like the deployment guide says.

        // The deployment guide says:
        // 1. Transfer `genesis_key.json`
        // 2. `mv ~/genesis_key.json ~/NaivecoinStake-Proof-of-Stake-Core/`
        // Wait, where does it go?
        // docker-compose says: `- ./genesis_key.json:/app/node/wallet/private_key`
        // And wallet.ts reads that file.

        // So `genesis_key.json` MUST contain valid wallet file content.
        // wallet.ts: 
        // const buffer = readFileSync(privateKeyFile, 'utf8');
        // return buffer.toString();

        // So it expects the hex string of the seed directly.

        // Create valid JSON object
        const keyObj = { privateKey: seedHex };

        const outputPath = path.resolve(__dirname, '../genesis_key.json');
        fs.writeFileSync(outputPath, JSON.stringify(keyObj, null, 2));

        const pubKeyPath = path.resolve(__dirname, '../genesis_pubkey.txt');
        fs.writeFileSync(pubKeyPath, publicKeyHex);

        console.log('SUCCESS!');
        console.log('Public Key (Address):', publicKeyHex);
        console.log('Private Key (Seed) saved to:', outputPath);
        console.log('Content:', seedHex);

    } catch (e) {
        console.error('Error:', e);
    }
};

generate();
