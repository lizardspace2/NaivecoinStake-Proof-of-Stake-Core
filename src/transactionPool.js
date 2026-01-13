"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCandidateTransactions = exports.updateTransactionPool = exports.getTransactionPool = exports.addToTransactionPool = void 0;
const lodash_1 = __importDefault(require("lodash"));
const transaction_1 = require("./transaction");
const MAX_TRANSACTION_POOL_SIZE = 1000;
let transactionPool = [];
const getTransactionPool = () => {
    return lodash_1.default.cloneDeep(transactionPool);
};
exports.getTransactionPool = getTransactionPool;
const addToTransactionPool = (tx, unspentTxOuts) => {
    // Validation throws specific errors now
    (0, transaction_1.validateTransaction)(tx, unspentTxOuts);
    if (!isValidTxForPool(tx, transactionPool)) {
        throw Error('Transaction inputs already in pool');
    }
    if (transactionPool.length >= MAX_TRANSACTION_POOL_SIZE) {
        const poolWithFees = transactionPool.map(t => ({ tx: t, fee: (0, transaction_1.getTxFee)(t, unspentTxOuts) }));
        const minFeeTx = lodash_1.default.minBy(poolWithFees, 'fee');
        const newTxFee = (0, transaction_1.getTxFee)(tx, unspentTxOuts);
        if (minFeeTx && minFeeTx.fee < newTxFee) {
            console.log('Evicting low fee tx: ' + minFeeTx.tx.id);
            transactionPool = lodash_1.default.without(transactionPool, minFeeTx.tx);
        }
        else {
            throw Error('Transaction pool full and fee too low to evict others');
        }
    }
    console.log('adding to txPool: %s', JSON.stringify(tx));
    transactionPool.push(tx);
};
exports.addToTransactionPool = addToTransactionPool;
const hasTxIn = (txIn, unspentTxOuts) => {
    const foundTxIn = unspentTxOuts.find((uTxO) => {
        return uTxO.txOutId === txIn.txOutId && uTxO.txOutIndex === txIn.txOutIndex;
    });
    return foundTxIn !== undefined;
};
const updateTransactionPool = (unspentTxOuts) => {
    const invalidTxs = [];
    for (const tx of transactionPool) {
        for (const txIn of tx.txIns) {
            if (!hasTxIn(txIn, unspentTxOuts)) {
                invalidTxs.push(tx);
                break;
            }
        }
    }
    if (invalidTxs.length > 0) {
        console.log('removing the following transactions from txPool: %s', JSON.stringify(invalidTxs));
        transactionPool = lodash_1.default.without(transactionPool, ...invalidTxs);
    }
};
exports.updateTransactionPool = updateTransactionPool;
const getTxPoolIns = (aTransactionPool) => {
    return (0, lodash_1.default)(aTransactionPool)
        .map((tx) => tx.txIns)
        .flatten()
        .value();
};
const isValidTxForPool = (tx, aTtransactionPool) => {
    const txPoolIns = getTxPoolIns(aTtransactionPool);
    const containsTxIn = (txIns, txIn) => {
        return lodash_1.default.find(txPoolIns, ((txPoolIn) => {
            return txIn.txOutIndex === txPoolIn.txOutIndex && txIn.txOutId === txPoolIn.txOutId;
        }));
    };
    for (const txIn of tx.txIns) {
        if (containsTxIn(txPoolIns, txIn)) {
            console.log('txIn already found in the txPool');
            return false;
        }
    }
    return true;
};
const getCandidateTransactions = (limit, unspentTxOuts) => {
    return (0, lodash_1.default)(transactionPool)
        .map(tx => ({ tx, fee: (0, transaction_1.getTxFee)(tx, unspentTxOuts) }))
        .orderBy(['fee'], ['desc'])
        .take(limit)
        .map(wrapper => wrapper.tx)
        .value();
};
exports.getCandidateTransactions = getCandidateTransactions;
//# sourceMappingURL=transactionPool.js.map