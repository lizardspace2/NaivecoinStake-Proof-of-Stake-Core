"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const _ = require("lodash");
const transaction_1 = require("./transaction");
const MAX_TRANSACTION_POOL_SIZE = 1000;
let transactionPool = [];
const getTransactionPool = () => {
    return _.cloneDeep(transactionPool);
};
exports.getTransactionPool = getTransactionPool;
const addToTransactionPool = (tx, unspentTxOuts) => {
    if (!transaction_1.validateTransaction(tx, unspentTxOuts)) {
        throw Error('Trying to add invalid tx to pool');
    }
    if (!isValidTxForPool(tx, transactionPool)) {
        throw Error('Trying to add invalid tx to pool');
    }
    if (transactionPool.length >= MAX_TRANSACTION_POOL_SIZE) {
        const poolWithFees = transactionPool.map(t => ({ tx: t, fee: transaction_1.getTxFee(t, unspentTxOuts) }));
        const minFeeTx = _.minBy(poolWithFees, 'fee');
        const newTxFee = transaction_1.getTxFee(tx, unspentTxOuts);
        if (minFeeTx && minFeeTx.fee < newTxFee) {
            console.log('Evicting low fee tx: ' + minFeeTx.tx.id);
            transactionPool = _.without(transactionPool, minFeeTx.tx);
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
        transactionPool = _.without(transactionPool, ...invalidTxs);
    }
};
exports.updateTransactionPool = updateTransactionPool;
const getTxPoolIns = (aTransactionPool) => {
    return _(aTransactionPool)
        .map((tx) => tx.txIns)
        .flatten()
        .value();
};
const isValidTxForPool = (tx, aTtransactionPool) => {
    const txPoolIns = getTxPoolIns(aTtransactionPool);
    const containsTxIn = (txIns, txIn) => {
        return _.find(txPoolIns, ((txPoolIn) => {
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
    return _(transactionPool)
        .map(tx => ({ tx, fee: transaction_1.getTxFee(tx, unspentTxOuts) }))
        .orderBy(['fee'], ['desc'])
        .take(limit)
        .map(wrapper => wrapper.tx)
        .value();
};
exports.getCandidateTransactions = getCandidateTransactions;
//# sourceMappingURL=transactionPool.js.map