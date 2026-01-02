import * as CryptoJS from 'crypto-js';
import * as _ from 'lodash';
import { getDilithiumSync, DILITHIUM_LEVEL } from './wallet';
import { ValidationError, ValidationErrorCode } from './validation_errors';

const COINBASE_AMOUNT_INITIAL: number = 50;
const HALVING_INTERVAL: number = 100000;

export const getCoinbaseAmount = (blockIndex: number): number => {
    const halvings = Math.floor(blockIndex / HALVING_INTERVAL);
    let amount = COINBASE_AMOUNT_INITIAL;
    for (let i = 0; i < halvings; i++) {
        amount = amount / 2;
    }
    return amount;
};

export const getCoinbaseTransaction = (address: string, blockIndex: number, blockFees: number = 0): Transaction => {
    const t = new Transaction();
    const txIn: TxIn = new TxIn();
    txIn.signature = '';
    txIn.txOutId = '';
    txIn.txOutIndex = blockIndex;

    t.txIns = [txIn];

    const reward = getCoinbaseAmount(blockIndex) + blockFees;

    t.txOuts = [new TxOut(address, reward)];
    t.id = getTransactionId(t);
    return t;
};

export const getTxFee = (transaction: Transaction, aUnspentTxOuts: UnspentTxOut[]): number => {
    if (transaction.txIns[0].txOutId === '') {
        return 0;
    }

    const totalIn = transaction.txIns
        .map((txIn) => getTxInAmount(txIn, aUnspentTxOuts))
        .reduce((a, b) => a + b, 0);

    const totalOut = transaction.txOuts
        .map((txOut) => txOut.amount)
        .reduce((a, b) => a + b, 0);

    return totalIn - totalOut;
};

class UnspentTxOut {
    public readonly txOutId: string;
    public readonly txOutIndex: number;
    public readonly address: string;
    public readonly amount: number;

    constructor(txOutId: string, txOutIndex: number, address: string, amount: number) {
        this.txOutId = txOutId;
        this.txOutIndex = txOutIndex;
        this.address = address;
        this.amount = amount;
    }
}

class TxIn {
    public txOutId: string;
    public txOutIndex: number;
    public signature: string;
}

class TxOut {
    public address: string;
    public amount: number;

    constructor(address: string, amount: number) {
        this.address = address;
        this.amount = amount;
    }
}

class Transaction {

    public id: string;

    public txIns: TxIn[];
    public txOuts: TxOut[];
}

const getTransactionId = (transaction: Transaction): string => {
    const txInContent: string = transaction.txIns
        .map((txIn: TxIn) => txIn.txOutId + txIn.txOutIndex)
        .reduce((a, b) => a + b, '');

    const txOutContent: string = transaction.txOuts
        .map((txOut: TxOut) => txOut.address + txOut.amount)
        .reduce((a, b) => a + b, '');

    return CryptoJS.SHA256(txInContent + txOutContent).toString();
};

const validateTransaction = (transaction: Transaction, aUnspentTxOuts: UnspentTxOut[]): boolean => {

    if (!isValidTransactionStructure(transaction)) {
        throw new ValidationError('invalid transaction structure: ' + JSON.stringify(transaction), ValidationErrorCode.INVALID_STRUCTURE, true);
    }

    if (getTransactionId(transaction) !== transaction.id) {
        throw new ValidationError('invalid tx id: ' + transaction.id, ValidationErrorCode.INVALID_STRUCTURE, true);
    }
    const hasValidTxIns: boolean = transaction.txIns
        .map((txIn) => validateTxIn(txIn, transaction, aUnspentTxOuts))
        .reduce((a, b) => a && b, true);

    if (!hasValidTxIns) {
        throw new ValidationError('some of the txIns are invalid in tx: ' + transaction.id, ValidationErrorCode.INVALID_SIGNATURE, true);
    }

    const totalTxInValues: number = transaction.txIns
        .map((txIn) => getTxInAmount(txIn, aUnspentTxOuts))
        .reduce((a, b) => (a + b), 0);

    const totalTxOutValues: number = transaction.txOuts
        .map((txOut) => txOut.amount)
        .reduce((a, b) => (a + b), 0);

    if (totalTxOutValues !== totalTxInValues) {
        if (totalTxOutValues > totalTxInValues) {
            throw new ValidationError('totalTxOutValues > totalTxInValues in tx: ' + transaction.id, ValidationErrorCode.INSUFFICIENT_FUNDS, true);
        }
    }

    if (getTxFee(transaction, aUnspentTxOuts) < 0.00001) {
        throw new ValidationError('transaction fee too low: ' + getTxFee(transaction, aUnspentTxOuts), ValidationErrorCode.INVALID_FEE, false);
    }

    return true;
};

const validateBlockTransactions = (aTransactions: Transaction[], aUnspentTxOuts: UnspentTxOut[], blockIndex: number): boolean => {
    const coinbaseTx = aTransactions[0];
    if (!validateCoinbaseTx(coinbaseTx, blockIndex)) {
        throw new ValidationError('invalid coinbase transaction: ' + JSON.stringify(coinbaseTx), ValidationErrorCode.INVALID_COINBASE, true);
    }

    const txIns: TxIn[] = _(aTransactions)
        .map((tx) => tx.txIns)
        .flatten()
        .value();

    if (hasDuplicates(txIns)) {
        throw new ValidationError('duplicate txIns found in block transactions', ValidationErrorCode.DUPLICATE_TX, true);
    }

    const normalTransactions: Transaction[] = aTransactions.slice(1);
    for (const tx of normalTransactions) {
        validateTransaction(tx, aUnspentTxOuts);
    }
    return true;

};

const hasDuplicates = (txIns: TxIn[]): boolean => {
    const groups = _.countBy(txIns, (txIn: TxIn) => txIn.txOutId + txIn.txOutIndex);
    return _(groups)
        .map((value, key) => {
            if (value > 1) {
                console.log('duplicate txIn: ' + key);
                return true;
            } else {
                return false;
            }
        })
        .includes(true);
};

const validateCoinbaseTx = (transaction: Transaction, blockIndex: number): boolean => {
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
    } else if (transaction.txOuts[0].amount !== getCoinbaseAmount(blockIndex)) {
        if (transaction.txOuts[0].amount < getCoinbaseAmount(blockIndex)) {
            console.log('invalid coinbase amount in coinbase transaction');
            return false;
        }
    }
    return true;
};

const validateTxIn = (txIn: TxIn, transaction: Transaction, aUnspentTxOuts: UnspentTxOut[]): boolean => {
    const referencedUTxOut: UnspentTxOut =
        aUnspentTxOuts.find((uTxO) => uTxO.txOutId === txIn.txOutId && uTxO.txOutIndex === txIn.txOutIndex);
    if (referencedUTxOut == null) {
        throw new ValidationError('referenced txOut not found: ' + JSON.stringify(txIn), ValidationErrorCode.INSUFFICIENT_FUNDS, true);
    }
    const address = referencedUTxOut.address;

    try {
        const dilithium = getDilithiumSync();
        const publicKeyArray = Buffer.from(address, 'hex');
        const signatureArray = Buffer.from(txIn.signature, 'hex');
        const messageArray = Buffer.from(transaction.id, 'hex');

        const publicKey = new Uint8Array(publicKeyArray);
        const signature = new Uint8Array(signatureArray);
        const message = new Uint8Array(messageArray);

        const validSignature: boolean = dilithium.verify(signature, message, publicKey, DILITHIUM_LEVEL);
        if (!validSignature) {
            console.log('invalid txIn signature: %s txId: %s address: %s', txIn.signature, transaction.id, referencedUTxOut.address);
            throw new ValidationError(`invalid txIn signature: ${txIn.signature} txId: ${transaction.id} address: ${referencedUTxOut.address}`, ValidationErrorCode.INVALID_SIGNATURE, true);
        }
        return true;
    } catch (error) {
        console.log('error verifying signature: ' + error.message);
        return false;
    }
};

const getTxInAmount = (txIn: TxIn, aUnspentTxOuts: UnspentTxOut[]): number => {
    return findUnspentTxOut(txIn.txOutId, txIn.txOutIndex, aUnspentTxOuts).amount;
};

const findUnspentTxOut = (transactionId: string, index: number, aUnspentTxOuts: UnspentTxOut[]): UnspentTxOut => {
    return aUnspentTxOuts.find((uTxO) => uTxO.txOutId === transactionId && uTxO.txOutIndex === index);
};

const signTxIn = (transaction: Transaction, txInIndex: number,
    privateKey: string, aUnspentTxOuts: UnspentTxOut[]): string => {
    const txIn: TxIn = transaction.txIns[txInIndex];

    const dataToSign = transaction.id;
    const referencedUnspentTxOut: UnspentTxOut = findUnspentTxOut(txIn.txOutId, txIn.txOutIndex, aUnspentTxOuts);
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
        const dilithium = getDilithiumSync();
        const keyPair = JSON.parse(privateKey);

        const messageBuffer = Buffer.from(dataToSign, 'hex');

        const privateKeyUint8 = new Uint8Array(keyPair.privateKey);
        const messageUint8 = new Uint8Array(messageBuffer);

        const signature = dilithium.sign(messageUint8, privateKeyUint8, DILITHIUM_LEVEL);
        if (typeof signature === 'object' && !Array.isArray(signature) && !(signature instanceof Uint8Array)) {
            if ('signature' in signature) {
                // @ts-ignore
                return Buffer.from(signature.signature).toString('hex');
            }

            const sigArray = _.values(signature);
            return Buffer.from(sigArray as any).toString('hex');
        }

        return Buffer.from(signature).toString('hex');
    } catch (error) {
        console.log('error signing transaction: ' + error.message);
        throw error;
    }
};

const updateUnspentTxOuts = (aTransactions: Transaction[], aUnspentTxOuts: UnspentTxOut[]): UnspentTxOut[] => {
    const newUnspentTxOuts: UnspentTxOut[] = aTransactions
        .map((t) => {
            return t.txOuts.map((txOut, index) => new UnspentTxOut(t.id, index, txOut.address, txOut.amount));
        })
        .reduce((a, b) => a.concat(b), []);

    const consumedTxOuts: UnspentTxOut[] = aTransactions
        .map((t) => t.txIns)
        .reduce((a, b) => a.concat(b), [])
        .map((txIn) => new UnspentTxOut(txIn.txOutId, txIn.txOutIndex, '', 0));

    const resultingUnspentTxOuts = aUnspentTxOuts
        .filter(((uTxO) => !findUnspentTxOut(uTxO.txOutId, uTxO.txOutIndex, consumedTxOuts)))
        .concat(newUnspentTxOuts);

    return resultingUnspentTxOuts;
};

const processTransactions = (aTransactions: Transaction[], aUnspentTxOuts: UnspentTxOut[], blockIndex: number) => {

    if (!validateBlockTransactions(aTransactions, aUnspentTxOuts, blockIndex)) {
        console.log('invalid block transactions');
        return null;
    }
    return updateUnspentTxOuts(aTransactions, aUnspentTxOuts);
};

const getPublicKey = (aPrivateKey: string): string => {
    try {
        const keyPair = JSON.parse(aPrivateKey);
        return Buffer.from(keyPair.publicKey).toString('hex');
    } catch (error) {
        console.log('error getting public key: ' + error.message);
        throw error;
    }
};

const isValidTxInStructure = (txIn: TxIn): boolean => {
    if (txIn == null) {
        console.log('txIn is null');
        return false;
    } else if (typeof txIn.signature !== 'string') {
        console.log('invalid signature type in txIn');
        return false;
    } else if (typeof txIn.txOutId !== 'string') {
        console.log('invalid txOutId type in txIn');
        return false;
    } else if (typeof txIn.txOutIndex !== 'number') {
        console.log('invalid txOutIndex type in txIn');
        return false;
    } else {
        return true;
    }
};

const isValidTxOutStructure = (txOut: TxOut): boolean => {
    if (txOut == null) {
        console.log('txOut is null');
        return false;
    } else if (typeof txOut.address !== 'string') {
        console.log('invalid address type in txOut');
        return false;
    } else if (!isValidAddress(txOut.address)) {
        console.log('invalid TxOut address');
        return false;
    } else if (typeof txOut.amount !== 'number') {
        console.log('invalid amount type in txOut');
        return false;
    } else {
        return true;
    }
};

const isValidTransactionStructure = (transaction: Transaction) => {
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

const isValidAddress = (address: string): boolean => {
    if (address.length < 100) {
        console.log('invalid public key length (too short)');
        return false;
    } else if (address.length > 10000) {
        console.log('invalid public key length (too long)');
        return false;
    } else if (address.match('^[a-fA-F0-9]+$') === null) {
        console.log('public key must contain only hex characters');
        return false;
    }
    try {
        const publicKeyBuffer = Buffer.from(address, 'hex');
        if (publicKeyBuffer.length !== 1472) {
            console.log('public key size mismatch. Expected 1472 bytes, got ' + publicKeyBuffer.length);
            return false;
        }
        return true;
    } catch (error) {
        console.log('error validating address: ' + error.message);
        return false;
    }
};

export {
    processTransactions, signTxIn, getTransactionId, isValidAddress, validateTransaction,
    UnspentTxOut, TxIn, TxOut, getPublicKey, hasDuplicates,
    Transaction, validateBlockTransactions
};
