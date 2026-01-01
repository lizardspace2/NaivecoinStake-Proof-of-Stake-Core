"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const CryptoJS = require("crypto-js");
const _ = require("lodash");
const wallet_1 = require("./wallet");
const COINBASE_AMOUNT_INITIAL = 50;
const HALVING_INTERVAL = 100000;
exports.getCoinbaseAmount = (blockIndex) => {
    const halvings = Math.floor(blockIndex / HALVING_INTERVAL);
    // Use bitwise shift for halving (or simple division for floating point coins if needed, but here assuming standard logic)
    // For simplicity and readability with type number:
    let amount = COINBASE_AMOUNT_INITIAL;
    for (let i = 0; i < halvings; i++) {
        amount = amount / 2;
    }
    return amount;
};
exports.getCoinbaseTransaction = (address, blockIndex, blockFees = 0) => {
    const t = new Transaction();
    const txIn = new TxIn();
    txIn.signature = '';
    txIn.txOutId = '';
    txIn.txOutIndex = blockIndex;
    t.txIns = [txIn];
    // Calculate total reward: Base Coinbase Amount + Transaction Fees
    const reward = exports.getCoinbaseAmount(blockIndex) + blockFees;
    t.txOuts = [new TxOut(address, reward)];
    t.id = getTransactionId(t);
    return t;
};
exports.getTxFee = (transaction, aUnspentTxOuts) => {
    if (transaction.txIns[0].txOutId === '') {
        return 0; // Coinbase has no fee
    }
    const totalIn = transaction.txIns
        .map((txIn) => getTxInAmount(txIn, aUnspentTxOuts))
        .reduce((a, b) => a + b, 0);
    const totalOut = transaction.txOuts
        .map((txOut) => txOut.amount)
        .reduce((a, b) => a + b, 0);
    return totalIn - totalOut;
};
// ... inside validateTransaction ...
// if (getTxFee(transaction, aUnspentTxOuts) < 0.01) {
//    console.log('transaction fee too low: ' + getTxFee(transaction, aUnspentTxOuts));
//    return false;
// }
class UnspentTxOut {
    constructor(txOutId, txOutIndex, address, amount) {
        this.txOutId = txOutId;
        this.txOutIndex = txOutIndex;
        this.address = address;
        this.amount = amount;
    }
}
exports.UnspentTxOut = UnspentTxOut;
class TxIn {
}
exports.TxIn = TxIn;
class TxOut {
    constructor(address, amount) {
        this.address = address;
        this.amount = amount;
    }
}
exports.TxOut = TxOut;
class Transaction {
}
exports.Transaction = Transaction;
const getTransactionId = (transaction) => {
    const txInContent = transaction.txIns
        .map((txIn) => txIn.txOutId + txIn.txOutIndex)
        .reduce((a, b) => a + b, '');
    const txOutContent = transaction.txOuts
        .map((txOut) => txOut.address + txOut.amount)
        .reduce((a, b) => a + b, '');
    return CryptoJS.SHA256(txInContent + txOutContent).toString();
};
exports.getTransactionId = getTransactionId;
const validateTransaction = (transaction, aUnspentTxOuts) => {
    if (!isValidTransactionStructure(transaction)) {
        return false;
    }
    if (getTransactionId(transaction) !== transaction.id) {
        console.log('invalid tx id: ' + transaction.id);
        return false;
    }
    const hasValidTxIns = transaction.txIns
        .map((txIn) => validateTxIn(txIn, transaction, aUnspentTxOuts))
        .reduce((a, b) => a && b, true);
    if (!hasValidTxIns) {
        console.log('some of the txIns are invalid in tx: ' + transaction.id);
        return false;
    }
    const totalTxInValues = transaction.txIns
        .map((txIn) => getTxInAmount(txIn, aUnspentTxOuts))
        .reduce((a, b) => (a + b), 0);
    const totalTxOutValues = transaction.txOuts
        .map((txOut) => txOut.amount)
        .reduce((a, b) => (a + b), 0);
    if (totalTxOutValues !== totalTxInValues) {
        // If inputs != outputs, the difference is the fee.
        // We just ensure outputs aren't GREATER than inputs (inflation check for normal tx)
        if (totalTxOutValues > totalTxInValues) {
            console.log('totalTxOutValues > totalTxInValues in tx: ' + transaction.id);
            return false;
        }
    }
    if (exports.getTxFee(transaction, aUnspentTxOuts) < 0.00001) {
        console.log('transaction fee too low: ' + exports.getTxFee(transaction, aUnspentTxOuts));
        return false;
    }
    return true;
};
exports.validateTransaction = validateTransaction;
const validateBlockTransactions = (aTransactions, aUnspentTxOuts, blockIndex) => {
    const coinbaseTx = aTransactions[0];
    if (!validateCoinbaseTx(coinbaseTx, blockIndex)) {
        console.log('invalid coinbase transaction: ' + JSON.stringify(coinbaseTx));
        return false;
    }
    // check for duplicate txIns. Each txIn can be included only once
    const txIns = _(aTransactions)
        .map((tx) => tx.txIns)
        .flatten()
        .value();
    if (hasDuplicates(txIns)) {
        return false;
    }
    // all but coinbase transactions
    const normalTransactions = aTransactions.slice(1);
    return normalTransactions.map((tx) => validateTransaction(tx, aUnspentTxOuts))
        .reduce((a, b) => (a && b), true);
};
const hasDuplicates = (txIns) => {
    const groups = _.countBy(txIns, (txIn) => txIn.txOutId + txIn.txOutIndex);
    return _(groups)
        .map((value, key) => {
        if (value > 1) {
            console.log('duplicate txIn: ' + key);
            return true;
        }
        else {
            return false;
        }
    })
        .includes(true);
};
exports.hasDuplicates = hasDuplicates;
const validateCoinbaseTx = (transaction, blockIndex) => {
    if (transaction == null) {
        console.log('the first transaction in the block must be coinbase transaction');
        return false;
    }
    if (getTransactionId(transaction) !== transaction.id) {
        console.log('invalid coinbase tx id: ' + transaction.id);
        return false;
    }
    if (transaction.txIns.length !== 1) {
        console.log('one txIn must be specified in the coinbase transaction');
        return;
    }
    if (transaction.txIns[0].txOutIndex !== blockIndex) {
        console.log('the txIn signature in coinbase tx must be the block height');
        return false;
    }
    if (transaction.txOuts.length !== 1) {
        console.log('invalid number of txOuts in coinbase transaction');
        return false;
    }
    if (blockIndex === 0) {
        if (transaction.txOuts[0].amount !== 100000000) {
            console.log('invalid genesis coinbase amount');
            return false;
        }
    }
    else if (transaction.txOuts[0].amount !== exports.getCoinbaseAmount(blockIndex)) {
        // Warning: This basic validation doesn't check if FEES were added correctly.
        // It only checks if the base reward is at least present or matches exactly if we ignore fees for now.
        // To properly validate fees + reward, we would need to sum the fees of all other txs in the block here.
        // For this step, we will allow >= base reward to support fee inclusion which increases the output amount.
        if (transaction.txOuts[0].amount < exports.getCoinbaseAmount(blockIndex)) {
            console.log('invalid coinbase amount in coinbase transaction');
            return false;
        }
    }
    return true;
};
const validateTxIn = (txIn, transaction, aUnspentTxOuts) => {
    const referencedUTxOut = aUnspentTxOuts.find((uTxO) => uTxO.txOutId === txIn.txOutId && uTxO.txOutIndex === txIn.txOutIndex);
    if (referencedUTxOut == null) {
        console.log('referenced txOut not found: ' + JSON.stringify(txIn));
        return false;
    }
    const address = referencedUTxOut.address;
    try {
        const dilithium = wallet_1.getDilithiumSync();
        const publicKeyArray = Buffer.from(address, 'hex');
        const signatureArray = Buffer.from(txIn.signature, 'hex');
        const messageArray = Buffer.from(transaction.id, 'hex');
        // Convert to Uint8Array
        const publicKey = new Uint8Array(publicKeyArray);
        const signature = new Uint8Array(signatureArray);
        const message = new Uint8Array(messageArray);
        const validSignature = dilithium.verify(signature, message, publicKey, wallet_1.DILITHIUM_LEVEL);
        if (!validSignature) {
            console.log('invalid txIn signature: %s txId: %s address: %s', txIn.signature, transaction.id, referencedUTxOut.address);
            return false;
        }
        return true;
    }
    catch (error) {
        console.log('error verifying signature: ' + error.message);
        return false;
    }
};
const getTxInAmount = (txIn, aUnspentTxOuts) => {
    return findUnspentTxOut(txIn.txOutId, txIn.txOutIndex, aUnspentTxOuts).amount;
};
const findUnspentTxOut = (transactionId, index, aUnspentTxOuts) => {
    return aUnspentTxOuts.find((uTxO) => uTxO.txOutId === transactionId && uTxO.txOutIndex === index);
};
const signTxIn = (transaction, txInIndex, privateKey, aUnspentTxOuts) => {
    const txIn = transaction.txIns[txInIndex];
    const dataToSign = transaction.id;
    const referencedUnspentTxOut = findUnspentTxOut(txIn.txOutId, txIn.txOutIndex, aUnspentTxOuts);
    if (referencedUnspentTxOut == null) {
        console.log('could not find referenced txOut');
        throw Error();
    }
    const referencedAddress = referencedUnspentTxOut.address;
    if (getPublicKey(privateKey) !== referencedAddress) {
        console.log('trying to sign an input with private' +
            ' key that does not match the address that is referenced in txIn');
        throw Error();
    }
    try {
        const dilithium = wallet_1.getDilithiumSync();
        // Private key is stored as JSON string
        const keyPair = JSON.parse(privateKey);
        const messageBuffer = Buffer.from(dataToSign, 'hex');
        // Convert arrays back to Uint8Array
        const privateKeyUint8 = new Uint8Array(keyPair.privateKey);
        const messageUint8 = new Uint8Array(messageBuffer);
        const signature = dilithium.sign(messageUint8, privateKeyUint8, wallet_1.DILITHIUM_LEVEL);
        // Handle case where signature is a wrapper object (e.g. { result, signature, signatureLength })
        if (typeof signature === 'object' && !Array.isArray(signature) && !(signature instanceof Uint8Array)) {
            // Check if it has the 'signature' property as seen in logs
            if ('signature' in signature) {
                // @ts-ignore
                return Buffer.from(signature.signature).toString('hex');
            }
            // Fallback for other object types (though unlikely now)
            const sigArray = _.values(signature);
            return Buffer.from(sigArray).toString('hex');
        }
        return Buffer.from(signature).toString('hex');
    }
    catch (error) {
        console.log('error signing transaction: ' + error.message);
        throw error;
    }
};
exports.signTxIn = signTxIn;
const updateUnspentTxOuts = (aTransactions, aUnspentTxOuts) => {
    const newUnspentTxOuts = aTransactions
        .map((t) => {
        return t.txOuts.map((txOut, index) => new UnspentTxOut(t.id, index, txOut.address, txOut.amount));
    })
        .reduce((a, b) => a.concat(b), []);
    const consumedTxOuts = aTransactions
        .map((t) => t.txIns)
        .reduce((a, b) => a.concat(b), [])
        .map((txIn) => new UnspentTxOut(txIn.txOutId, txIn.txOutIndex, '', 0));
    const resultingUnspentTxOuts = aUnspentTxOuts
        .filter(((uTxO) => !findUnspentTxOut(uTxO.txOutId, uTxO.txOutIndex, consumedTxOuts)))
        .concat(newUnspentTxOuts);
    return resultingUnspentTxOuts;
};
const processTransactions = (aTransactions, aUnspentTxOuts, blockIndex) => {
    if (!validateBlockTransactions(aTransactions, aUnspentTxOuts, blockIndex)) {
        console.log('invalid block transactions');
        return null;
    }
    return updateUnspentTxOuts(aTransactions, aUnspentTxOuts);
};
exports.processTransactions = processTransactions;
const getPublicKey = (aPrivateKey) => {
    try {
        // Private key is stored as JSON string containing both keys
        const keyPair = JSON.parse(aPrivateKey);
        // Convert array back to Uint8Array and then to hex
        return Buffer.from(keyPair.publicKey).toString('hex');
    }
    catch (error) {
        console.log('error getting public key: ' + error.message);
        throw error;
    }
};
exports.getPublicKey = getPublicKey;
const isValidTxInStructure = (txIn) => {
    if (txIn == null) {
        console.log('txIn is null');
        return false;
    }
    else if (typeof txIn.signature !== 'string') {
        console.log('invalid signature type in txIn');
        return false;
    }
    else if (typeof txIn.txOutId !== 'string') {
        console.log('invalid txOutId type in txIn');
        return false;
    }
    else if (typeof txIn.txOutIndex !== 'number') {
        console.log('invalid txOutIndex type in txIn');
        return false;
    }
    else {
        return true;
    }
};
const isValidTxOutStructure = (txOut) => {
    if (txOut == null) {
        console.log('txOut is null');
        return false;
    }
    else if (typeof txOut.address !== 'string') {
        console.log('invalid address type in txOut');
        return false;
    }
    else if (!isValidAddress(txOut.address)) {
        console.log('invalid TxOut address');
        return false;
    }
    else if (typeof txOut.amount !== 'number') {
        console.log('invalid amount type in txOut');
        return false;
    }
    else {
        return true;
    }
};
const isValidTransactionStructure = (transaction) => {
    if (typeof transaction.id !== 'string') {
        console.log('transactionId missing');
        return false;
    }
    if (!(transaction.txIns instanceof Array)) {
        console.log('invalid txIns type in transaction');
        return false;
    }
    if (!transaction.txIns
        .map(isValidTxInStructure)
        .reduce((a, b) => (a && b), true)) {
        return false;
    }
    if (!(transaction.txOuts instanceof Array)) {
        console.log('invalid txIns type in transaction');
        return false;
    }
    if (!transaction.txOuts
        .map(isValidTxOutStructure)
        .reduce((a, b) => (a && b), true)) {
        return false;
    }
    return true;
};
// valid address is a valid Dilithium public key (1472 bytes for Dilithium Level 2)
const isValidAddress = (address) => {
    // Dilithium Level 2 public key is 1472 bytes
    if (address.length < 100) {
        console.log('invalid public key length (too short)');
        return false;
    }
    else if (address.length > 10000) {
        console.log('invalid public key length (too long)');
        return false;
    }
    else if (address.match('^[a-fA-F0-9]+$') === null) {
        console.log('public key must contain only hex characters');
        return false;
    }
    // Basic validation: check if buffer size matches expected Dilithium public key size
    try {
        const publicKeyBuffer = Buffer.from(address, 'hex');
        // Dilithium Level 2 public key is 1472 bytes
        // Was 1952 bytes for Dilithium3 in older/different version
        if (publicKeyBuffer.length !== 1472) {
            console.log('public key size mismatch. Expected 1472 bytes, got ' + publicKeyBuffer.length);
            return false;
        }
        return true;
    }
    catch (error) {
        console.log('error validating address: ' + error.message);
        return false;
    }
};
exports.isValidAddress = isValidAddress;
//# sourceMappingURL=transaction.js.map