
import * as fs from 'fs';
try {
    const keys = JSON.parse(fs.readFileSync('genesis_key.json', 'utf8'));
    const hex = Buffer.from(keys.publicKey).toString('hex');
    fs.writeFileSync('genesis_pubkey.txt', hex);
    console.log('Saved to genesis_pubkey.txt');
} catch (e) {
    console.error(e);
}
