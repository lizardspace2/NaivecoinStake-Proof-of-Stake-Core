
import * as DilithiumModule from 'dilithium-crystals-js';
import * as fs from 'fs';

const generate = async () => {
    try {
        const dilithium = await DilithiumModule;
        const DILITHIUM_LEVEL = 2;
        const keyPair = dilithium.generateKeys(DILITHIUM_LEVEL);

        const publicKeyHex = Buffer.from(keyPair.publicKey).toString('hex');

        const keyPairObj = {
            publicKey: Array.from(keyPair.publicKey),
            privateKey: Array.from(keyPair.privateKey)
        };

        console.log('Public Key (Address):', publicKeyHex);
        console.log('Private Key JSON:', JSON.stringify(keyPairObj));

        fs.writeFileSync('genesis_key.json', JSON.stringify(keyPairObj, null, 2));
        console.log('Keys saved to genesis_key.json');

    } catch (e) {
        console.error(e);
    }
};

generate();
