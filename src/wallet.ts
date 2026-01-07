import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'fs';
import * as _ from 'lodash';
import * as DilithiumModule from 'dilithium-crystals-js';
import { getPublicKey, getTransactionId, signTxIn, Transaction, TxIn, TxOut, UnspentTxOut } from './transaction';

const privateKeyLocation = process.env.PRIVATE_KEY || 'node/wallet/private_key';

let dilithiumInstance: any = null;

const getDilithium = (): any => {
    if (dilithiumInstance === null) {
        throw new Error('Dilithium not initialized. Call initDilithium() first.');
    }
    return dilithiumInstance;
};

const initDilithium = async (): Promise<void> => {
    if (dilithiumInstance === null) {
        dilithiumInstance = await DilithiumModule;
    }
};

const getDilithiumSync = (): any => {
    if (dilithiumInstance === null) {
        throw new Error('Dilithium not initialized. Ensure initDilithium() was called.');
    }
    return dilithiumInstance;
};

const DILITHIUM_LEVEL = 2;

const getPrivateFromWallet = (): string => {
    const buffer = readFileSync(privateKeyLocation, 'utf8');
    return buffer.toString();
};

const getPublicFromWallet = (): string => {
    const privateKey = getPrivateFromWallet();
    try {
        const keyPair = JSON.parse(privateKey);
        return Buffer.from(keyPair.publicKey).toString('hex');
    } catch (error) {
        throw new Error('Invalid key format. Please regenerate wallet.');
    }
};

const generatePrivateKey = (): string => {
    const dilithium = getDilithiumSync();
    const keyPair = dilithium.generateKeys(DILITHIUM_LEVEL);
    const keyPairObj = {
        publicKey: Array.from(keyPair.publicKey),
        privateKey: Array.from(keyPair.privateKey)
    };
    return JSON.stringify(keyPairObj);
};

const initWallet = () => {
    if (existsSync(privateKeyLocation)) {
        return;
    }
    try {
        const newPrivateKey = generatePrivateKey();
        writeFileSync(privateKeyLocation, newPrivateKey);
        console.log('new wallet with private key created to : %s', privateKeyLocation);
    } catch (error) {
        console.error('Error initializing wallet. Make sure Quantix cryptography is initialized first.');
        throw error;
    }
};

const deleteWallet = () => {
    if (existsSync(privateKeyLocation)) {
        unlinkSync(privateKeyLocation);
    }
};

const getBalance = (address: string, unspentTxOuts: UnspentTxOut[]): number => {
    return _(findUnspentTxOuts(address, unspentTxOuts))
        .map((uTxO: UnspentTxOut) => uTxO.amount)
        .sum();
};

const findUnspentTxOuts = (ownerAddress: string, unspentTxOuts: UnspentTxOut[]) => {
    return _.filter(unspentTxOuts, (uTxO: UnspentTxOut) => uTxO.address === ownerAddress);
};

const findTxOutsForAmount = (amount: number, myUnspentTxOuts: UnspentTxOut[]) => {
    let currentAmount = 0;
    const includedUnspentTxOuts = [];
    for (const myUnspentTxOut of myUnspentTxOuts) {
        includedUnspentTxOuts.push(myUnspentTxOut);
        currentAmount = currentAmount + myUnspentTxOut.amount;
        if (currentAmount >= amount + 0.0001) {
            const leftOverAmount = currentAmount - amount - 0.0001;
            return { includedUnspentTxOuts, leftOverAmount };
        }
    }

    const totalAvailable = myUnspentTxOuts.map(u => u.amount).reduce((a, b) => a + b, 0);
    const eMsg = `Insufficient funds: Required ${amount}, Available ${totalAvailable}`;
    throw Error(eMsg);
};

const createTxOuts = (receiverAddress: string, myAddress: string, amount, leftOverAmount: number) => {
    const txOut1: TxOut = new TxOut(receiverAddress, amount);
    if (leftOverAmount === 0) {
        return [txOut1];
    } else {
        const leftOverTx = new TxOut(myAddress, leftOverAmount);
        return [txOut1, leftOverTx];
    }
};

const filterTxPoolTxs = (unspentTxOuts: UnspentTxOut[], transactionPool: Transaction[]): UnspentTxOut[] => {
    const txIns: TxIn[] = _(transactionPool)
        .map((tx: Transaction) => tx.txIns)
        .flatten()
        .value();
    const removable: UnspentTxOut[] = [];
    for (const unspentTxOut of unspentTxOuts) {
        const txIn = _.find(txIns, (aTxIn: TxIn) => {
            return aTxIn.txOutIndex === unspentTxOut.txOutIndex && aTxIn.txOutId === unspentTxOut.txOutId;
        });

        if (txIn === undefined) {

        } else {
            removable.push(unspentTxOut);
        }
    }

    return _.without(unspentTxOuts, ...removable);
};

const createTransaction = (receiverAddress: string, amount: number, privateKey: string,
    unspentTxOuts: UnspentTxOut[], txPool: Transaction[]): Transaction => {

    console.log('txPool: %s', JSON.stringify(txPool));
    const myAddress: string = getPublicKey(privateKey);
    const myUnspentTxOutsA = unspentTxOuts.filter((uTxO: UnspentTxOut) => uTxO.address === myAddress);

    const myUnspentTxOuts = filterTxPoolTxs(myUnspentTxOutsA, txPool);

    const { includedUnspentTxOuts, leftOverAmount } = findTxOutsForAmount(amount, myUnspentTxOuts);

    const toUnsignedTxIn = (unspentTxOut: UnspentTxOut) => {
        const txIn: TxIn = new TxIn();
        txIn.txOutId = unspentTxOut.txOutId;
        txIn.txOutIndex = unspentTxOut.txOutIndex;
        return txIn;
    };

    const unsignedTxIns: TxIn[] = includedUnspentTxOuts.map(toUnsignedTxIn);

    const tx: Transaction = new Transaction();
    tx.txIns = unsignedTxIns;
    tx.txOuts = createTxOuts(receiverAddress, myAddress, amount, leftOverAmount);
    tx.id = getTransactionId(tx);

    tx.txIns = tx.txIns.map((txIn: TxIn, index: number) => {
        txIn.signature = signTxIn(tx, index, privateKey, unspentTxOuts);
        return txIn;
    });

    return tx;
};

export {
    createTransaction, getPublicFromWallet,
    getPrivateFromWallet, getBalance, generatePrivateKey, initWallet, deleteWallet, findUnspentTxOuts, initDilithium, getDilithiumSync, DILITHIUM_LEVEL
};
