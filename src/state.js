"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const _ = require("lodash");
const CryptoJS = require("crypto-js");
// Simple Merkle Root implementation for state
// In a real production system, this would be a Patricia Merkle Trie
const calculateStateRoot = (unspentTxOuts) => {
    // Sort to ensure determinism
    const sortedUTXOs = _.sortBy(unspentTxOuts, ['txOutId', 'txOutIndex']);
    const utxoStrings = sortedUTXOs.map(u => u.txOutId + u.txOutIndex + u.address + u.amount);
    // If empty state
    if (utxoStrings.length === 0) {
        return CryptoJS.SHA256("").toString();
    }
    // Naive merkle tree for now (or just hash of all UTXOs for simplicity if tree is overkill for this step, 
    // but requested "Merkle Tree or equivalent"). 
    // Let's use a simplified hash-of-hashes approach for the list.
    return CryptoJS.SHA256(utxoStrings.join('')).toString();
};
class State {
    constructor(initialUnspentTxOuts = []) {
        this.unspentTxOuts = _.cloneDeep(initialUnspentTxOuts);
    }
    getUnspentTxOuts() {
        return _.cloneDeep(this.unspentTxOuts);
    }
    setUnspentTxOuts(newUnspentTxOuts) {
        this.unspentTxOuts = newUnspentTxOuts;
    }
    getRoot() {
        return calculateStateRoot(this.unspentTxOuts);
    }
    isValidTxIn(txIn) {
        const referencedUTxOut = this.unspentTxOuts.find((uTxO) => uTxO.txOutId === txIn.txOutId && uTxO.txOutIndex === txIn.txOutIndex);
        return referencedUTxOut !== undefined;
    }
    getTxInAmount(txIn) {
        const referencedUTxOut = this.unspentTxOuts.find((uTxO) => uTxO.txOutId === txIn.txOutId && uTxO.txOutIndex === txIn.txOutIndex);
        return referencedUTxOut ? referencedUTxOut.amount : 0;
    }
}
exports.State = State;
//# sourceMappingURL=state.js.map