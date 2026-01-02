import * as CryptoJS from 'crypto-js';
import { Transaction } from './transaction';

const getMerkleRoot = (transactions: Transaction[]): string => {
    const count = transactions.length;
    if (count === 0) {
        return '';
    }
    const previousTreeLayer: string[] = transactions.map((t) => t.id);
    const treeLayer: string[] = previousTreeLayer;

    return getMerkleRootRecursive(treeLayer);
};

const getMerkleRootRecursive = (layer: string[]): string => {
    if (layer.length === 1) {
        return layer[0];
    }
    const newLayer: string[] = [];
    for (let i = 0; i < layer.length; i += 2) {
        const left = layer[i];
        const right = (i + 1 < layer.length) ? layer[i + 1] : left;
        const hash = CryptoJS.SHA256(left + right).toString();
        newLayer.push(hash);
    }
    return getMerkleRootRecursive(newLayer);
};

export { getMerkleRoot };
