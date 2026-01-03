"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const _ = require("lodash");
const CryptoJS = require("crypto-js");
const calculateStateRoot = (unspentTxOuts) => {
    const sortedUTXOs = _.sortBy(unspentTxOuts, ['txOutId', 'txOutIndex']);
    const utxoStrings = sortedUTXOs.map(u => u.txOutId + u.txOutIndex + u.address + u.amount);
    if (utxoStrings.length === 0) {
        return CryptoJS.SHA256("").toString();
    }
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