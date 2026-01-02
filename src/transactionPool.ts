import * as _ from 'lodash';
import { Transaction, TxIn, UnspentTxOut, validateTransaction, getTxFee } from './transaction';

const MAX_TRANSACTION_POOL_SIZE = 1000;

let transactionPool: Transaction[] = [];

const getTransactionPool = () => {
    return _.cloneDeep(transactionPool);
};

const addToTransactionPool = (tx: Transaction, unspentTxOuts: UnspentTxOut[]) => {

    if (!validateTransaction(tx, unspentTxOuts)) {
        throw Error('Trying to add invalid tx to pool');
    }

    if (!isValidTxForPool(tx, transactionPool)) {
        throw Error('Trying to add invalid tx to pool');
    }

    if (transactionPool.length >= MAX_TRANSACTION_POOL_SIZE) {
        // Evict transaction with lowest fee
        // We need unspentTxOuts to calculate fees for all txs in pool.
        // For simplicity, we assume we have access or pass it.
        // Wait, 'validateTransaction' is called, so we have 'unspentTxOuts'.
        // But for *other* txs in pool, we need their fees.
        // Computing fees for ALL pool txs every time we add might be slow?
        // Let's do it simply for now.

        // This is O(N) check.
        const poolWithFees = transactionPool.map(t => ({ tx: t, fee: getTxFee(t, unspentTxOuts) }));
        const minFeeTx = _.minBy(poolWithFees, 'fee');
        const newTxFee = getTxFee(tx, unspentTxOuts);

        if (minFeeTx && minFeeTx.fee < newTxFee) {
            console.log('Evicting low fee tx: ' + minFeeTx.tx.id);
            transactionPool = _.without(transactionPool, minFeeTx.tx);
        } else {
            throw Error('Transaction pool full and fee too low to evict others');
        }
    }

    console.log('adding to txPool: %s', JSON.stringify(tx));
    transactionPool.push(tx);
};

const hasTxIn = (txIn: TxIn, unspentTxOuts: UnspentTxOut[]): boolean => {
    const foundTxIn = unspentTxOuts.find((uTxO: UnspentTxOut) => {
        return uTxO.txOutId === txIn.txOutId && uTxO.txOutIndex === txIn.txOutIndex;
    });
    return foundTxIn !== undefined;
};

const updateTransactionPool = (unspentTxOuts: UnspentTxOut[]) => {
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

const getTxPoolIns = (aTransactionPool: Transaction[]): TxIn[] => {
    return _(aTransactionPool)
        .map((tx) => tx.txIns)
        .flatten()
        .value();
};

const isValidTxForPool = (tx: Transaction, aTtransactionPool: Transaction[]): boolean => {
    const txPoolIns: TxIn[] = getTxPoolIns(aTtransactionPool);

    const containsTxIn = (txIns: TxIn[], txIn: TxIn) => {
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

// Returns top N transactions by fee for mining
const getCandidateTransactions = (limit: number, unspentTxOuts: UnspentTxOut[]): Transaction[] => {
    return _(transactionPool)
        .map(tx => ({ tx, fee: getTxFee(tx, unspentTxOuts) }))
        .orderBy(['fee'], ['desc'])
        .take(limit)
        .map(wrapper => wrapper.tx)
        .value();
};

export { addToTransactionPool, getTransactionPool, updateTransactionPool, getCandidateTransactions };
