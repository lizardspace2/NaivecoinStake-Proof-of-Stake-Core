"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const _ = require("lodash");
const DilithiumModule = require("dilithium-crystals-js");
const transaction_1 = require("./transaction");
const privateKeyLocation = process.env.PRIVATE_KEY || 'node/wallet/private_key';
let dilithiumInstance = null;
const getDilithium = () => {
    if (dilithiumInstance === null) {
        throw new Error('Dilithium not initialized. Call initDilithium() first.');
    }
    return dilithiumInstance;
};
const initDilithium = () => __awaiter(this, void 0, void 0, function* () {
    if (dilithiumInstance === null) {
        dilithiumInstance = yield DilithiumModule;
    }
});
exports.initDilithium = initDilithium;
const getDilithiumSync = () => {
    if (dilithiumInstance === null) {
        throw new Error('Dilithium not initialized. Ensure initDilithium() was called.');
    }
    return dilithiumInstance;
};
exports.getDilithiumSync = getDilithiumSync;
const DILITHIUM_LEVEL = 2;
exports.DILITHIUM_LEVEL = DILITHIUM_LEVEL;
const getPrivateFromWallet = () => {
    const buffer = fs_1.readFileSync(privateKeyLocation, 'utf8');
    return buffer.toString();
};
exports.getPrivateFromWallet = getPrivateFromWallet;
const getPublicFromWallet = () => {
    const privateKey = getPrivateFromWallet();
    try {
        const keyPair = JSON.parse(privateKey);
        return Buffer.from(keyPair.publicKey).toString('hex');
    }
    catch (error) {
        throw new Error('Invalid key format. Please regenerate wallet.');
    }
};
exports.getPublicFromWallet = getPublicFromWallet;
const generatePrivateKey = () => {
    const dilithium = getDilithiumSync();
    const keyPair = dilithium.generateKeys(DILITHIUM_LEVEL);
    const keyPairObj = {
        publicKey: Array.from(keyPair.publicKey),
        privateKey: Array.from(keyPair.privateKey)
    };
    return JSON.stringify(keyPairObj);
};
exports.generatePrivateKey = generatePrivateKey;
const initWallet = () => {
    if (fs_1.existsSync(privateKeyLocation)) {
        return;
    }
    try {
        const newPrivateKey = generatePrivateKey();
        fs_1.writeFileSync(privateKeyLocation, newPrivateKey);
        console.log('new wallet with private key created to : %s', privateKeyLocation);
    }
    catch (error) {
        console.error('Error initializing wallet. Make sure Dilithium is initialized first.');
        throw error;
    }
};
exports.initWallet = initWallet;
const deleteWallet = () => {
    if (fs_1.existsSync(privateKeyLocation)) {
        fs_1.unlinkSync(privateKeyLocation);
    }
};
exports.deleteWallet = deleteWallet;
const getBalance = (address, unspentTxOuts) => {
    return _(findUnspentTxOuts(address, unspentTxOuts))
        .map((uTxO) => uTxO.amount)
        .sum();
};
exports.getBalance = getBalance;
const findUnspentTxOuts = (ownerAddress, unspentTxOuts) => {
    return _.filter(unspentTxOuts, (uTxO) => uTxO.address === ownerAddress);
};
exports.findUnspentTxOuts = findUnspentTxOuts;
const findTxOutsForAmount = (amount, myUnspentTxOuts) => {
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
const createTxOuts = (receiverAddress, myAddress, amount, leftOverAmount) => {
    const txOut1 = new transaction_1.TxOut(receiverAddress, amount);
    if (leftOverAmount === 0) {
        return [txOut1];
    }
    else {
        const leftOverTx = new transaction_1.TxOut(myAddress, leftOverAmount);
        return [txOut1, leftOverTx];
    }
};
const filterTxPoolTxs = (unspentTxOuts, transactionPool) => {
    const txIns = _(transactionPool)
        .map((tx) => tx.txIns)
        .flatten()
        .value();
    const removable = [];
    for (const unspentTxOut of unspentTxOuts) {
        const txIn = _.find(txIns, (aTxIn) => {
            return aTxIn.txOutIndex === unspentTxOut.txOutIndex && aTxIn.txOutId === unspentTxOut.txOutId;
        });
        if (txIn === undefined) {
        }
        else {
            removable.push(unspentTxOut);
        }
    }
    return _.without(unspentTxOuts, ...removable);
};
const createTransaction = (receiverAddress, amount, privateKey, unspentTxOuts, txPool) => {
    console.log('txPool: %s', JSON.stringify(txPool));
    const myAddress = transaction_1.getPublicKey(privateKey);
    const myUnspentTxOutsA = unspentTxOuts.filter((uTxO) => uTxO.address === myAddress);
    const myUnspentTxOuts = filterTxPoolTxs(myUnspentTxOutsA, txPool);
    const { includedUnspentTxOuts, leftOverAmount } = findTxOutsForAmount(amount, myUnspentTxOuts);
    const toUnsignedTxIn = (unspentTxOut) => {
        const txIn = new transaction_1.TxIn();
        txIn.txOutId = unspentTxOut.txOutId;
        txIn.txOutIndex = unspentTxOut.txOutIndex;
        return txIn;
    };
    const unsignedTxIns = includedUnspentTxOuts.map(toUnsignedTxIn);
    const tx = new transaction_1.Transaction();
    tx.txIns = unsignedTxIns;
    tx.txOuts = createTxOuts(receiverAddress, myAddress, amount, leftOverAmount);
    tx.id = transaction_1.getTransactionId(tx);
    tx.txIns = tx.txIns.map((txIn, index) => {
        txIn.signature = transaction_1.signTxIn(tx, index, privateKey, unspentTxOuts);
        return txIn;
    });
    return tx;
};
exports.createTransaction = createTransaction;
//# sourceMappingURL=wallet.js.map