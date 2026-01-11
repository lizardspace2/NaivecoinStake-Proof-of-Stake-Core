"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.State = void 0;
const _ = __importStar(require("lodash"));
const CryptoJS = __importStar(require("crypto-js"));
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