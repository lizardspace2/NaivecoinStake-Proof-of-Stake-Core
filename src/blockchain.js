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
exports.getAllBalances = exports.getTotalSupply = exports.isValidBlockHeader = exports.getBlockHeaders = exports.initGenesisBlock = exports.getCumulativeDifficulty = exports.addBlockToChain = exports.replaceChain = exports.isValidBlockStructure = exports.getAccountBalance = exports.getMyUnspentTransactionOutputs = exports.handleReceivedTransaction = exports.generatenextBlockWithTransaction = exports.generateNextBlock = exports.generateRawNextBlock = exports.sendTransaction = exports.getLatestBlock = exports.getUnspentTxOuts = exports.getBlockchain = exports.Block = void 0;
/*
 * Copyright 2026 lizrdspace2
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * This file has been modified by lizrdspace2.
 * Based on work by Sandoche Adittane and Lauri Hartikka.
 */
const CryptoJS = __importStar(require("crypto-js"));
const _ = __importStar(require("lodash"));
const fs_1 = require("fs");
const p2p_1 = require("./p2p");
const merkle_1 = require("./merkle");
const transaction_1 = require("./transaction");
const transactionPool_1 = require("./transactionPool");
const wallet_1 = require("./wallet");
const bignumber_js_1 = require("bignumber.js");
const utils_async_1 = require("./utils_async");
const validation_errors_1 = require("./validation_errors");
const state_1 = require("./state");
const execution_1 = require("./execution");
class Block {
    constructor(index, hash, previousHash, timestamp, data, merkleRoot, difficulty, minterBalance, minterAddress, stateRoot = '') {
        this.index = index;
        this.previousHash = previousHash;
        this.timestamp = timestamp;
        this.data = data;
        this.merkleRoot = merkleRoot;
        this.hash = hash;
        this.difficulty = difficulty;
        this.minterBalance = minterBalance;
        this.minterAddress = minterAddress;
        this.stateRoot = stateRoot;
    }
}
exports.Block = Block;
let genesisBlock = null;
const mintingWithoutCoinIndex = 1000000;
const DATA_DIR = 'data';
const BLOCKCHAIN_FILE = 'data/blockchain.json';
let blockchain = [];
let globalState = new state_1.State();
let unspentTxOuts = [];
const TWO_POW_256 = new bignumber_js_1.BigNumber(2).exponentiatedBy(256);
const GENESIS_ADDRESS = '90ff154149a501a9d407347278caca92dea821b8c96c11180e6977c5a2f6246e6d5200b303c1d50a4c0f70b36947daa488c3518bc303db308634369c9fdf4545df808bcc7bf4230f963a5e6ff60a7145a4e9bc0b097837ce38be1611da88cfa02a84dab3aef589b3b43c27ece3e031266a3b8218645e00098824cb589d33d9cd7af47ebd76d25a42f2e59f9f0c4537f9f946ccb1475fb0254676e87a2d6e8574f28826199ec97258f134e96ed06ba67e0d3ee7b18719f528dca74677d8028c967b7431aa20bf9b3711e13bd5b684fb88976f1524145cc01774227dfcd890d6137f5e80dbf7d6b58941b196548c4a36672e9d3ff5d3a344a9eaad260988bea6db1fd03308e6a0ef53a07c85fe08d06014fa1426e535696f339ff43ed97b480d3c52d9f9cea1a02f53e453dc110c3289670a4eef12f599fdaa99c8a93b1fe636c8b7cc3c3cc0dc279ef14e0e90d261686594258514723e6db0212cb240ac05fe3607bd54c2602d635c772b9efcfeddf2d23683e008c32421cf41d6a5fdc34d004764775505e08170bb0cc5f5be8801ac981103b04288556869d94a4096e9d60f7f551eb222ff4ee578d3be62e62615779dcb7ac03af7e2945716ba144cff2f3b50d76c10dc38047a25d3471967b63f9475ad523b8336a77a4f52247706f2afe5c0c5909b97d6e3edfe1e79f9c48cd2710a32df48703a88cc67d7dfd01b70454094db1a0ca0ce9ec51a49bc8ee59d54fd44c79a3a90a2deb523b60b58fcd1b2a854d20bd889ce25bedfa7d1e5cdb87c06bdbb5486b0dad24966ea82805a2550b8f80e51f1ca9e37a7bbc30ea35f34b4584d9d6b03a23d98b7dca260b8186ab273c5d38c5ee1b1191e2735432489da65e2377fcbc113a26eded51c5015efd755b017f9c475524816d8d811fd1f32cd8f8f8a8f9e5b10766e30ae88cfa54a3c9e49974d9dac056889a22fa39ba44fd9f72b298d9aa0b9f33952f4ba0a6731251bc9a765c9f54fc838c9b97e5b36a04ca9adb18f115abdafc3fadbcc9b12b74bb04dad690d22e8a9efff1c1f2e92470dbe5ad9224fc3e3773eacaa91b25224d4898b48889bfec1bc9a5c3744083d32d86c0b5a93b49b2965993af1d8377c9d84b5b9eb2d5d5772b04670b27197c1e0361159439e6700e1713daeac618fcbaf673a9266e48400311bdd413104f0801fd8ea229cfe413f9f0f53ac2c8c79a10c3ec27c550a0a2e4e4af86cacbee629edb703e2720a744dee4d0fa4c5bdd5169a8bae037eca97174f5ade49fc405386d17a07887e61aa50ac2149ccd0053f686efb48776cb10dde17594d3a732162a1729a05bc03dc393194846c6e655b4a091996bc25cb876a92475d076525160c66d34692dc678d88da3bc1fad36615218ce95db3beb1269a3e38fc279a0e3eabd7ced2b68c37f99f380eca3e2e2b19d2d2501e4e97f57180317a9f44a30b721bae9b240c5b0a03406538c9a1b9725d24dd450779bd63d17d93685cfd948c15c6cef2781ce3b6ae54f5e776a73b753dc2ba821430ac57c61ccd550a4b56c9d85e2be2df44f2c4ef917a6a625f36738ba102ee8b278f5531513d6168c8415281f983a10187ac31d5bbdf060236310ed9f47f052e0728e2962f934aa71309e6099c11e3b6fa493c9b826f257e2be77e77ce87acd16f80257a650d3d61cd4a4d09d979f2ea2adeec144395ef4a6f5f19bc36aca447052dc5a80576a205478b0a04536e6f50c32efd8fdb86e49413b05c06fe0ade755321e994790e5e9e8a1ad70e05b7df74e0b4262767a37f69635851c2285d74f85915708402dfcc2e4cce0ad54e49636a5d0992085ddb7bc7964efd550c1f4b4c7c753e8361598de9584cfc6a8aafda5b5e96c356c79f6485ce5371832649abd0df8b94b1dd9d8f197d0c1e1d499c47749611cb0b7eb323e06a026f696988387c19040f8ff26dbbe2911180b096f407a9544de5a6788c1a8b319b6521e4f0184b88e306768a8271726c6baa0cd68f79b788a12e5cff0ab365c73eb7d94eb5282cffec3453b6948e4fb206a98904a6dde9996211e9b7d999dde290705b6e84240b7789944d875b32abc69de46568897a98ce96be42fa0e44a9ee36ca2a688beb6affe5fd26592f4c4f56fefe91069c0c262c035d2835d85e658ce5c5982bf988567963cf60c099a11a263f1b591d5bb7e565cfbdf70a8e082a409242d1c54fc276fe98e03fb58ee0f5ca57e367c31209c5b662df28d53ac79644d955ac7977f18d2cf6c222147f06c1e24b726a7790f7662b96f8117ffce2626b27320fbc9ed1329155bf39e168c0cf07eb60e19124e2cc6053c1bbca599f33617a4930ed62020d6726bed7798f631359b2e4ba75f8f6d9de2b8f0e0da7204e5e0573e3729d41819ce792ae5fc109e9aba07a24c819c9d5851cf7e0e6c28a26c1c87744f5ff11f53082ce3c0c9927f78baca193a727580277cb612d8469949d210a984e1c904b0230821e4efa969cbd3e63b677821c4bd6bfa09140043598ef82a3a0c57184f10056fa5b3edfb5a9a59d8d9fbda86d0118bf65ac2b101856f57262af77b243ac1ef6d7b00a3d86c85c5f1db69ee42bc61888fad57c0fd8e5add8b2b55d2fe379e1a6e8046d1456f5d0434217282b0bc37c566fcac74cd8986377560f1550e1c479fb4285baf4fcf018f837249b7f8b7674caf584a83996d9b0f318f4630ed32f9fcdccb0da65a3bdc0b3499e6b20d1366ef582eff19558863b0a9b2a949759d8c5d77df2';
const initGenesisBlock = () => {
    if ((0, fs_1.existsSync)(BLOCKCHAIN_FILE)) {
        console.log('Loading blockchain from local file...');
        try {
            const fileContent = (0, fs_1.readFileSync)(BLOCKCHAIN_FILE, 'utf8');
            const loadedChain = JSON.parse(fileContent);
            let tempUnspentTxOuts = [];
            for (const block of loadedChain) {
                const retVal = (0, transaction_1.processTransactions)(block.data, tempUnspentTxOuts, block.index);
                if (retVal === null) {
                    throw Error('Invalid transactions in stored blockchain block ' + block.index);
                }
                tempUnspentTxOuts = retVal;
            }
            blockchain = loadedChain;
            unspentTxOuts = tempUnspentTxOuts;
            globalState = new state_1.State(unspentTxOuts);
            genesisBlock = blockchain[0];
            console.log('Blockchain loaded successfully. Height: ' + getLatestBlock().index);
            return;
        }
        catch (e) {
            console.log('Error loading blockchain from file, starting fresh: ' + e.message);
        }
    }
    try {
        const genesisAddress = GENESIS_ADDRESS;
        const genesisTransaction = {
            'txIns': [{ 'signature': '', 'txOutId': '', 'txOutIndex': 0 }],
            'txOuts': [{
                    'address': genesisAddress,
                    'amount': 100000000
                }],
            'id': ''
        };
        const txInContent = genesisTransaction.txIns
            .map((txIn) => txIn.txOutId + txIn.txOutIndex)
            .reduce((a, b) => a + b, '');
        const txOutContent = genesisTransaction.txOuts
            .map((txOut) => txOut.address + txOut.amount)
            .reduce((a, b) => a + b, '');
        genesisTransaction.id = CryptoJS.SHA256(txInContent + txOutContent).toString();
        const timestamp = 1465154705;
        const genesisMerkleRoot = (0, merkle_1.getMerkleRoot)([genesisTransaction]);
        const genesisDifficulty = 100000000;
        const genesisState = new state_1.State((0, transaction_1.processTransactions)([genesisTransaction], [], 0));
        const genesisStateRoot = genesisState.getRoot();
        const hash = calculateHash(0, '', timestamp, genesisMerkleRoot, genesisDifficulty, 0, genesisAddress);
        genesisBlock = new Block(0, hash, '', timestamp, [genesisTransaction], genesisMerkleRoot, genesisDifficulty, 0, genesisAddress, genesisStateRoot);
        blockchain = [genesisBlock];
        unspentTxOuts = (0, transaction_1.processTransactions)(blockchain[0].data, [], 0);
        console.log('Genesis block initialized with Quantix address');
        saveBlockchain();
    }
    catch (error) {
        console.error('Error initializing genesis block:', error);
        throw error;
    }
};
exports.initGenesisBlock = initGenesisBlock;
const saveBlockchain = () => {
    try {
        if (!(0, fs_1.existsSync)(DATA_DIR)) {
            (0, fs_1.mkdirSync)(DATA_DIR);
        }
        (0, fs_1.writeFileSync)(BLOCKCHAIN_FILE, JSON.stringify(blockchain));
    }
    catch (e) {
        console.log('Error saving blockchain: ' + e.message);
    }
};
const getBlockchain = () => blockchain;
exports.getBlockchain = getBlockchain;
const getUnspentTxOuts = () => _.cloneDeep(unspentTxOuts);
exports.getUnspentTxOuts = getUnspentTxOuts;
const setUnspentTxOuts = (newUnspentTxOut) => {
    unspentTxOuts = newUnspentTxOut;
    globalState.setUnspentTxOuts(unspentTxOuts);
};
const getLatestBlock = () => blockchain[blockchain.length - 1];
exports.getLatestBlock = getLatestBlock;
const getBlockHeaders = (start, end) => {
    return blockchain
        .slice(start, end)
        .map((block) => ({
        ...block,
        data: []
    }));
};
exports.getBlockHeaders = getBlockHeaders;
const BLOCK_GENERATION_INTERVAL = 300;
const DIFFICULTY_ADJUSTMENT_INTERVAL = 10;
const getDifficulty = (aBlockchain) => {
    const latestBlock = aBlockchain[aBlockchain.length - 1];
    // Emergency Reset: If chain is stuck for > 1 hour, reset difficulty to 1 to allow recovery
    const currentTime = Math.round(new Date().getTime() / 1000);
    const timeSinceLastBlock = currentTime - latestBlock.timestamp;
    if (timeSinceLastBlock > 3600) {
        console.log(`EMERGENCY: Chain stuck for ${timeSinceLastBlock}s. Resetting difficulty to 1.`);
        return 1;
    }
    if (latestBlock.index % DIFFICULTY_ADJUSTMENT_INTERVAL === 0 && latestBlock.index !== 0) {
        return getAdjustedDifficulty(latestBlock, aBlockchain);
    }
    else {
        return latestBlock.difficulty;
    }
};
const getAdjustedDifficulty = (latestBlock, aBlockchain) => {
    const prevAdjustmentBlock = aBlockchain[blockchain.length - DIFFICULTY_ADJUSTMENT_INTERVAL];
    const timeExpected = BLOCK_GENERATION_INTERVAL * DIFFICULTY_ADJUSTMENT_INTERVAL;
    const timeTaken = latestBlock.timestamp - prevAdjustmentBlock.timestamp;
    if (timeTaken < 1) {
        return prevAdjustmentBlock.difficulty * 4;
    }
    const multiplier = timeExpected / timeTaken;
    let adjustedDifficulty = prevAdjustmentBlock.difficulty * multiplier;
    if (adjustedDifficulty > prevAdjustmentBlock.difficulty * 4) {
        adjustedDifficulty = prevAdjustmentBlock.difficulty * 4;
    }
    else if (adjustedDifficulty < prevAdjustmentBlock.difficulty / 4) {
        adjustedDifficulty = prevAdjustmentBlock.difficulty / 4;
    }
    return Math.max(Math.floor(adjustedDifficulty), 1);
};
const getCurrentTimestamp = () => Math.round(new Date().getTime() / 1000);
const generateRawNextBlock = async (blockData) => {
    const previousBlock = getLatestBlock();
    const difficulty = getDifficulty(getBlockchain());
    const nextIndex = previousBlock.index + 1;
    const newBlock = findBlock(nextIndex, previousBlock.hash, blockData, difficulty);
    if (newBlock !== null && await addBlockToChain(newBlock)) {
        (0, p2p_1.broadcastLatest)();
        return newBlock;
    }
    else {
        return null;
    }
};
exports.generateRawNextBlock = generateRawNextBlock;
const getMyUnspentTransactionOutputs = () => {
    return (0, wallet_1.findUnspentTxOuts)((0, wallet_1.getPublicFromWallet)(), getUnspentTxOuts());
};
exports.getMyUnspentTransactionOutputs = getMyUnspentTransactionOutputs;
const generateNextBlock = async () => {
    const minterAddress = (0, wallet_1.getPublicFromWallet)();
    const latestBlock = getLatestBlock();
    const nextIndex = latestBlock.index + 1;
    const poolTxs = (0, transactionPool_1.getCandidateTransactions)(50, getUnspentTxOuts());
    const totalFees = poolTxs
        .map((tx) => (0, transaction_1.getTxFee)(tx, getUnspentTxOuts()))
        .reduce((a, b) => a + b, 0);
    const coinbaseTx = (0, transaction_1.getCoinbaseTransaction)(minterAddress, nextIndex, totalFees);
    const blockData = [coinbaseTx].concat(poolTxs);
    return await generateRawNextBlock(blockData);
};
exports.generateNextBlock = generateNextBlock;
const generatenextBlockWithTransaction = async (receiverAddress, amount) => {
    if (!(0, transaction_1.isValidAddress)(receiverAddress)) {
        throw Error('invalid address');
    }
    if (typeof amount !== 'number') {
        throw Error('invalid amount');
    }
    const latestBlock = getLatestBlock();
    const nextIndex = latestBlock.index + 1;
    const minterAddress = (0, wallet_1.getPublicFromWallet)();
    const tx = (0, wallet_1.createTransaction)(receiverAddress, amount, (0, wallet_1.getPrivateFromWallet)(), getUnspentTxOuts(), (0, transactionPool_1.getTransactionPool)());
    const txFee = (0, transaction_1.getTxFee)(tx, getUnspentTxOuts());
    const coinbaseTx = (0, transaction_1.getCoinbaseTransaction)(minterAddress, nextIndex, txFee);
    const blockData = [coinbaseTx, tx];
    return await generateRawNextBlock(blockData);
};
exports.generatenextBlockWithTransaction = generatenextBlockWithTransaction;
const findBlock = (index, previousHash, data, difficulty) => {
    const timestamp = getCurrentTimestamp();
    const merkleRoot = (0, merkle_1.getMerkleRoot)(data);
    const hash = calculateHash(index, previousHash, timestamp, merkleRoot, difficulty, getAccountBalance(), (0, wallet_1.getPublicFromWallet)());
    if (isBlockStakingValid(previousHash, (0, wallet_1.getPublicFromWallet)(), timestamp, getAccountBalance(), difficulty, index)) {
        const currentUTXOs = getUnspentTxOuts();
        const nextUTXOs = (0, transaction_1.processTransactions)(data, currentUTXOs, index);
        const nextState = new state_1.State(nextUTXOs);
        const stateRoot = nextState.getRoot();
        return new Block(index, hash, previousHash, timestamp, data, merkleRoot, difficulty, getAccountBalance(), (0, wallet_1.getPublicFromWallet)(), stateRoot);
    }
    return null;
};
const getAccountBalance = () => {
    return (0, wallet_1.getBalance)((0, wallet_1.getPublicFromWallet)(), getUnspentTxOuts());
};
exports.getAccountBalance = getAccountBalance;
const sendTransaction = (address, amount) => {
    const tx = (0, wallet_1.createTransaction)(address, amount, (0, wallet_1.getPrivateFromWallet)(), getUnspentTxOuts(), (0, transactionPool_1.getTransactionPool)());
    (0, transactionPool_1.addToTransactionPool)(tx, getUnspentTxOuts());
    (0, p2p_1.broadCastTransactionPool)();
    return tx;
};
exports.sendTransaction = sendTransaction;
const calculateHashForBlock = (block) => calculateHash(block.index, block.previousHash, block.timestamp, block.merkleRoot, block.difficulty, block.minterBalance, block.minterAddress);
const calculateHash = (index, previousHash, timestamp, merkleRoot, difficulty, minterBalance, minterAddress) => CryptoJS.SHA256(index + previousHash + timestamp + merkleRoot + difficulty + minterBalance + minterAddress).toString();
const isValidBlockStructure = (block) => {
    return typeof block.index === 'number'
        && typeof block.hash === 'string'
        && typeof block.previousHash === 'string'
        && typeof block.timestamp === 'number'
        && typeof block.data === 'object'
        && typeof block.merkleRoot === 'string'
        && typeof block.merkleRoot === 'string'
        && typeof block.difficulty === 'number'
        && typeof block.minterBalance === 'number'
        && typeof block.minterAddress === 'string';
};
exports.isValidBlockStructure = isValidBlockStructure;
const isValidBlockHeader = (newBlock, previousBlock) => {
    if (!isValidBlockStructure(newBlock)) {
        console.log('invalid block structure: %s', JSON.stringify(newBlock));
        return false;
    }
    if (previousBlock.index + 1 !== newBlock.index) {
        console.log('invalid index');
        return false;
    }
    else if (previousBlock.hash !== newBlock.previousHash) {
        console.log('invalid previoushash');
        return false;
    }
    else if (!isValidTimestamp(newBlock, previousBlock)) {
        console.log('invalid timestamp');
        return false;
    }
    else if (!hasValidHash(newBlock)) {
        return false;
    }
    // Security Fix: Restrict Emergency Difficulty Reset to Genesis Address ONLY
    if (newBlock.difficulty === 1 && newBlock.index > 10) {
        if (newBlock.minterAddress !== GENESIS_ADDRESS) {
            console.log('INVALID MINTER: Only Genesis Address can mine recovery blocks with difficulty 1');
            return false;
        }
    }
    return true;
};
exports.isValidBlockHeader = isValidBlockHeader;
const isValidNewBlock = (newBlock, previousBlock) => {
    if (!isValidBlockHeader(newBlock, previousBlock)) {
        return false;
    }
    if ((0, merkle_1.getMerkleRoot)(newBlock.data) !== newBlock.merkleRoot) {
        console.log('invalid merkle root');
        return false;
    }
    return true;
};
const getAccumulatedDifficulty = (aBlockchain) => {
    return aBlockchain
        .reduce((sum, block) => sum.plus(new bignumber_js_1.BigNumber(2).exponentiatedBy(block.difficulty)), new bignumber_js_1.BigNumber(0));
};
const isValidTimestamp = (newBlock, previousBlock) => {
    return (previousBlock.timestamp - 60 < newBlock.timestamp)
        && newBlock.timestamp - 60 < getCurrentTimestamp();
};
const hasValidHash = (block) => {
    if (!hashMatchesBlockContent(block)) {
        console.log('invalid hash, got:' + block.hash);
        return false;
    }
    if (!isBlockStakingValid(block.previousHash, block.minterAddress, block.minterBalance, block.timestamp, block.difficulty, block.index)) {
        console.log('staking hash not lower than balance over diffculty times 2^256');
        return false;
    }
    return true;
};
const hashMatchesBlockContent = (block) => {
    const blockHash = calculateHashForBlock(block);
    return blockHash === block.hash;
};
const isBlockStakingValid = (prevhash, address, timestamp, balance, difficulty, index) => {
    difficulty = difficulty + 1;
    if (index <= mintingWithoutCoinIndex) {
        balance = balance + 1;
    }
    const balanceOverDifficulty = TWO_POW_256.times(balance).dividedBy(difficulty);
    const stakingHash = CryptoJS.SHA256(prevhash + address + timestamp).toString();
    const decimalStakingHash = new bignumber_js_1.BigNumber(stakingHash, 16);
    const difference = balanceOverDifficulty.minus(decimalStakingHash).toNumber();
    return difference >= 0;
};
const isValidChain = async (blockchainToValidate) => {
    console.log('isValidChain:');
    console.log(JSON.stringify(blockchainToValidate));
    const isValidGenesis = (block) => {
        if (block.index !== 0) {
            return false;
        }
        if (block.previousHash !== '') {
            return false;
        }
        if (block.data.length !== 1) {
            return false;
        }
        if (block.data[0].txIns.length !== 1 || block.data[0].txOuts.length !== 1) {
            return false;
        }
        if (block.data[0].txOuts[0].amount !== 100000000) {
            return false;
        }
        return hashMatchesBlockContent(block);
    };
    if (!isValidGenesis(blockchainToValidate[0])) {
        console.log('isValidChain: Genesis block validation failed');
        console.log('Expected: Index 0, PrevHash "", Date length 1, 1 TxIn/TxOut, Amount 100000000');
        console.log('Received: ' + JSON.stringify(blockchainToValidate[0]));
        return null;
    }
    let aUnspentTxOuts = [];
    for (let i = 0; i < blockchainToValidate.length; i++) {
        if (i % 10 === 0) {
            await (0, utils_async_1.yieldToEventLoop)();
        }
        const currentBlock = blockchainToValidate[i];
        let currentState;
        if (i === 0) {
            const genesisUTXOs = (0, transaction_1.processTransactions)(currentBlock.data, [], 0);
            currentState = new state_1.State(genesisUTXOs);
            if (currentBlock.stateRoot && currentBlock.stateRoot !== currentState.getRoot()) {
                throw new validation_errors_1.ValidationError('Genesis State Root mismatch', validation_errors_1.ValidationErrorCode.INVALID_BLOCK_HASH, true);
            }
            aUnspentTxOuts = genesisUTXOs;
        }
        else {
            currentState = new state_1.State(aUnspentTxOuts);
            if (!isValidNewBlock(currentBlock, blockchainToValidate[i - 1])) {
                console.log('isValidChain: Block ' + i + ' is invalid compared to block ' + (i - 1));
                return null;
            }
            try {
                const newState = await execution_1.BlockExecutor.executeBlock(currentBlock, currentState);
                aUnspentTxOuts = newState.getUnspentTxOuts();
            }
            catch (e) {
                console.log('Invalid block execution at index ' + i + ': ' + e.message);
                if (e instanceof validation_errors_1.ValidationError && e.shouldBan)
                    throw e;
                return null;
            }
        }
    }
    return aUnspentTxOuts;
};
const addBlockToChain = async (newBlock) => {
    if (isValidNewBlock(newBlock, getLatestBlock())) {
        try {
            const currentState = new state_1.State(getUnspentTxOuts());
            const newState = await execution_1.BlockExecutor.executeBlock(newBlock, currentState);
            const retVal = newState.getUnspentTxOuts();
            blockchain.push(newBlock);
            setUnspentTxOuts(retVal);
            (0, transactionPool_1.updateTransactionPool)(unspentTxOuts);
            saveBlockchain();
            return true;
        }
        catch (e) {
            console.log('block execution failed', e);
            if (e instanceof validation_errors_1.ValidationError && e.shouldBan)
                throw e;
            return false;
        }
    }
    else {
        return false;
    }
};
exports.addBlockToChain = addBlockToChain;
const getCumulativeDifficulty = (aBlockchain) => {
    return aBlockchain
        .map((block) => new bignumber_js_1.BigNumber(block.difficulty))
        .reduce((a, b) => a.plus(b), new bignumber_js_1.BigNumber(0));
};
exports.getCumulativeDifficulty = getCumulativeDifficulty;
const replaceChain = async (newBlocks) => {
    const newUnspentTxOuts = await isValidChain(newBlocks);
    if (newUnspentTxOuts !== null &&
        getCumulativeDifficulty(newBlocks).gt(getCumulativeDifficulty(blockchain))) {
        console.log('Received blockchain is valid. Replacing current blockchain with received blockchain');
        blockchain = newBlocks;
        setUnspentTxOuts(newUnspentTxOuts);
        (0, transactionPool_1.updateTransactionPool)(unspentTxOuts);
        (0, p2p_1.broadcastLatest)();
        saveBlockchain();
    }
    else {
        console.log('Received blockchain invalid or not heavier');
    }
};
exports.replaceChain = replaceChain;
const handleReceivedTransaction = (transaction) => {
    (0, transactionPool_1.addToTransactionPool)(transaction, getUnspentTxOuts());
};
exports.handleReceivedTransaction = handleReceivedTransaction;
const getTotalSupply = () => {
    return getUnspentTxOuts()
        .map((uTxO) => uTxO.amount)
        .reduce((a, b) => a + b, 0);
};
exports.getTotalSupply = getTotalSupply;
const getAllBalances = () => {
    const balances = {};
    getUnspentTxOuts().forEach((uTxO) => {
        if (!balances[uTxO.address]) {
            balances[uTxO.address] = 0;
        }
        balances[uTxO.address] += uTxO.amount;
    });
    return balances;
};
exports.getAllBalances = getAllBalances;
//# sourceMappingURL=blockchain.js.map