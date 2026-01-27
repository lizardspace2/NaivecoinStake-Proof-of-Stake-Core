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
import * as CryptoJS from 'crypto-js';
import * as _ from 'lodash';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { broadcastLatest, broadCastTransactionPool } from './p2p';
import { getMerkleRoot } from './merkle';
import {
    getCoinbaseTransaction, isValidAddress, processTransactions, Transaction, UnspentTxOut, getTxFee
} from './transaction';
import { addToTransactionPool, getTransactionPool, updateTransactionPool, getCandidateTransactions } from './transactionPool';
import { createTransaction, findUnspentTxOuts, getBalance, getPrivateFromWallet, getPublicFromWallet, getDilithiumSync, DILITHIUM_LEVEL } from './wallet';
import { BigNumber } from 'bignumber.js';
import { yieldToEventLoop } from './utils_async';
import { ValidationError, ValidationErrorCode } from './validation_errors';
import { State } from './state';
import { BlockExecutor } from './execution';

class Block {

    public index: number;
    public hash: string;
    public previousHash: string;
    public timestamp: number;
    public data: Transaction[];
    public merkleRoot: string;
    public difficulty: number;
    public minterBalance: number;
    public minterAddress: string;
    public stateRoot: string;

    constructor(index: number, hash: string, previousHash: string,
        timestamp: number, data: Transaction[], merkleRoot: string, difficulty: number, minterBalance: number, minterAddress: string, stateRoot: string = '') {
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

let genesisBlock: Block = null;

const mintingWithoutCoinIndex = 1000000;

const DATA_DIR = 'data';
const BLOCKCHAIN_FILE = 'data/blockchain.json';

let blockchain: Block[] = [];

let globalState: State = new State();
let unspentTxOuts: UnspentTxOut[] = [];

const TWO_POW_256 = new BigNumber(2).exponentiatedBy(256);

const GENESIS_ADDRESS = '663e6f45c7042d7317f732d90a2b55966ed22bc6ef92cda8f875609d721d92298aecbd1004ca3ea77feb059575d1ac5d0da44b56a249ea0412c5c306daf01404a07c913211f501369337ca15ef85e5f05a4c7261ef4923e9c69898d922c1b490f00deb0ca3ba64802884015dab7022e025659da3e4294ce1701b5a000cca2e56bce1a6590ef1e79f1475f972542619908000dc8e102bf45463097e0174463b625edbd50e5720e27de03023869c9861a955d0b5d06c627919cc5278a6313de1522d86323917192144acd2211773010a9f7fac641beb548b69458b813175b0b350d1f2991a1ef65355f6e4319f9c256bd87672028aa3d5eec570517ab74000cd50edaa2c5b88126732a5540fa3ed58689d0ce3aa459a4534ef2b4617c7a13b2de714f648c4e6697a0d2795ccb544418df03114447d44a8372810cdefdaaa2030aa73da3a860987d8a094d4ab48695b71ecf4720d8edd7cb962821e15deb1f8c2b4ec2ca9606b90caa3043e296fb45bd6be9ad6d70e58d766f070e301f24adc18d350dfd076ec68c6a4d5898a3d54871b1c00712620e208be2f8776036332adf17a17ee9d25801cec639570d4b863959472080bfaea72bb1538c3cbd0018259d83d15e0a0c2dc31cdcb10b4506ab27ba506759aa2d38b3139e2d5040f18edacfa360bfe2cd93b4cb3dacf5d4653aad686db39addf6210342a597801b28c36e178f874e6accb989b325eaf1c7b1b1028f33e2560567a7d49030ae7f8a2597dcd52ee0f39658bf46232e30c89d6cf462aef8e9cbbad0e0ae2949e2b55e7e0d5cbb56f91f21810d84688654b943439a4d3de14b847635b6bda311031fa0b4d9887fb784006e46f90bce0bc951a44870b2485df8fef5083b30024eb24563e06675cb3820de0f92ab7e28c35b863e403e308f8763541f0047ce238d288466dd7a78e6df9e53749d25e1b648ca79b58cd8e488a08533ba656240854cb986bb150221fc4bf147ff851a3ba3f92b6efb8da9b97945041718bf84067c34f118301d704e3b06c94ada2877e08b0416f91f567cfd2782fad1ccf8d6e5baf2a65c68bd5f333926da9b00033f675dea9fd4420882b30ec05d67629432df81cd4bb70b6418a94031535ecf4b5629d37cb7ac6a76de1175de7990bca337fc5b58e17aaab3b3e583349a344e248cf5d280c39e51131bc7eda5b4a2e9d6bef83189702b9a819068e1974f474fc7e119660c2c9bb71fd70b560c707a35bf61cba7a16435a8e301187bdb1935dd627293fe42c3e333fc637ee30a92675615e3f9828193f7a56efce06ec72f4f6cc4a27f25dbcff23f0597702e4bc49c1d06b8b39aec7ac5efb992524d2c9445cf602391a3fea5b2b4436cd89dd257a42c7d87ba719aa650f7ebee8609f145a013231a29f4574b7557edad18e22bf81d181d3c86e376b0b497890f2b309588d3b6c1f363ec444ff285f3eea9b355faeaeb84aeeb70b980d2c9bbd2b206b70c0ecadd62619909f379a142b20f7bb9bd091716af8ab2e6dfd45edbbd8a6f3da769bd2baf945d880368cf61f2abbe44111dda5974ad3fa28dd2154ff8b240275acc60f9299e52952457990bfd671e3a4cf6a273086928efee9d9642cc81259a8ff6af5cc6ffeb799bda0ae23d16cb003a9fa4afb01d8b72fc0212ee52c02aeb9d98c0c4565419037d43a08b1913172b44a334e5c66f4f36e103c0fd162557ac069a6a6e736a9e799aba37d9d093eae7b629b6537a760bfd31e5fe6fea916544394af647e64389b759d61571f695cfa45109a03fd4bfc58039ffd02a2b1b5e19a4e10700c9dfad9281f43be5d3128aa258aa25b4d5e5496fc4eec7210c5f0660f';

const initGenesisBlock = (): void => {
    if (existsSync(BLOCKCHAIN_FILE)) {
        console.log('Loading blockchain from local file...');
        try {
            const fileContent = readFileSync(BLOCKCHAIN_FILE, 'utf8');
            const loadedChain = JSON.parse(fileContent);

            let tempUnspentTxOuts: UnspentTxOut[] = [];

            for (const block of loadedChain) {
                const retVal = processTransactions(block.data, tempUnspentTxOuts, block.index);
                if (retVal === null) {
                    throw Error('Invalid transactions in stored blockchain block ' + block.index);
                }
                tempUnspentTxOuts = retVal;
            }

            blockchain = loadedChain;
            unspentTxOuts = tempUnspentTxOuts;
            globalState = new State(unspentTxOuts);
            genesisBlock = blockchain[0];
            console.log('Blockchain loaded successfully. Height: ' + getLatestBlock().index);
            return;
        } catch (e) {
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
            .map((txIn: any) => txIn.txOutId + txIn.txOutIndex)
            .reduce((a, b) => a + b, '');
        const txOutContent = genesisTransaction.txOuts
            .map((txOut: any) => txOut.address + txOut.amount)
            .reduce((a, b) => a + b, '');
        genesisTransaction.id = CryptoJS.SHA256(txInContent + txOutContent).toString();

        const timestamp = 1465154705;
        const genesisMerkleRoot = getMerkleRoot([genesisTransaction]);
        const genesisDifficulty = 100000000;
        const genesisState = new State(processTransactions([genesisTransaction], [], 0));
        const genesisStateRoot = genesisState.getRoot();

        const hash = calculateHash(0, '', timestamp, genesisMerkleRoot, genesisDifficulty, 0, genesisAddress);

        genesisBlock = new Block(
            0, hash, '', timestamp, [genesisTransaction], genesisMerkleRoot, genesisDifficulty, 0, genesisAddress, genesisStateRoot
        );

        blockchain = [genesisBlock];
        unspentTxOuts = processTransactions(blockchain[0].data, [], 0);

        console.log('Genesis block initialized with Quantix address');
        saveBlockchain();
    } catch (error) {
        console.error('Error initializing genesis block:', error);
        throw error;
    }
};

const saveBlockchain = () => {
    try {
        if (!existsSync(DATA_DIR)) {
            mkdirSync(DATA_DIR);
        }
        writeFileSync(BLOCKCHAIN_FILE, JSON.stringify(blockchain));
    } catch (e) {
        console.log('Error saving blockchain: ' + e.message);
    }
};

const getBlockchain = (): Block[] => blockchain;

const getUnspentTxOuts = (): UnspentTxOut[] => _.cloneDeep(unspentTxOuts);

const setUnspentTxOuts = (newUnspentTxOut: UnspentTxOut[]) => {
    unspentTxOuts = newUnspentTxOut;
    globalState.setUnspentTxOuts(unspentTxOuts);
};

const getLatestBlock = (): Block => blockchain[blockchain.length - 1];

const getBlockHeaders = (start: number, end: number): Block[] => {
    return blockchain
        .slice(start, end)
        .map((block) => ({
            ...block,
            data: []
        }));
};

const BLOCK_GENERATION_INTERVAL: number = 300;

const DIFFICULTY_ADJUSTMENT_INTERVAL: number = 10;

const getDifficulty = (aBlockchain: Block[]): number => {
    const latestBlock: Block = aBlockchain[aBlockchain.length - 1];

    // Emergency Reset: If chain is stuck for > 1 hour, reset difficulty to 1 to allow recovery
    const currentTime = Math.round(new Date().getTime() / 1000);
    const timeSinceLastBlock = currentTime - latestBlock.timestamp;
    if (timeSinceLastBlock > 3600) {
        console.log(`EMERGENCY: Chain stuck for ${timeSinceLastBlock}s. Resetting difficulty to 1.`);
        return 1;
    }

    if (latestBlock.index % DIFFICULTY_ADJUSTMENT_INTERVAL === 0 && latestBlock.index !== 0) {
        return getAdjustedDifficulty(latestBlock, aBlockchain);
    } else {
        return latestBlock.difficulty;
    }
};

const getAdjustedDifficulty = (latestBlock: Block, aBlockchain: Block[]) => {
    const prevAdjustmentBlock: Block = aBlockchain[blockchain.length - DIFFICULTY_ADJUSTMENT_INTERVAL];
    const timeExpected: number = BLOCK_GENERATION_INTERVAL * DIFFICULTY_ADJUSTMENT_INTERVAL;
    const timeTaken: number = latestBlock.timestamp - prevAdjustmentBlock.timestamp;

    if (timeTaken < 1) {
        return prevAdjustmentBlock.difficulty * 4;
    }
    const multiplier = timeExpected / timeTaken;
    let adjustedDifficulty = prevAdjustmentBlock.difficulty * multiplier;

    if (adjustedDifficulty > prevAdjustmentBlock.difficulty * 4) {
        adjustedDifficulty = prevAdjustmentBlock.difficulty * 4;
    } else if (adjustedDifficulty < prevAdjustmentBlock.difficulty / 4) {
        adjustedDifficulty = prevAdjustmentBlock.difficulty / 4;
    }

    return Math.max(Math.floor(adjustedDifficulty), 1);
};

const getCurrentTimestamp = (): number => Math.round(new Date().getTime() / 1000);

const generateRawNextBlock = async (blockData: Transaction[]) => {
    const previousBlock: Block = getLatestBlock();
    const difficulty: number = getDifficulty(getBlockchain());
    const nextIndex: number = previousBlock.index + 1;
    const newBlock: Block = findBlock(nextIndex, previousBlock.hash, blockData, difficulty);
    if (newBlock !== null && await addBlockToChain(newBlock)) {
        broadcastLatest();
        return newBlock;
    } else {
        return null;
    }

};

const getMyUnspentTransactionOutputs = () => {
    return findUnspentTxOuts(getPublicFromWallet(), getUnspentTxOuts());
};

const generateNextBlock = async () => {
    const minterAddress = getPublicFromWallet();
    const latestBlock = getLatestBlock();
    const nextIndex = latestBlock.index + 1;

    const poolTxs = getCandidateTransactions(50, getUnspentTxOuts());

    const totalFees = poolTxs
        .map((tx) => getTxFee(tx, getUnspentTxOuts()))
        .reduce((a, b) => a + b, 0);

    const coinbaseTx: Transaction = getCoinbaseTransaction(minterAddress, nextIndex, totalFees);
    const blockData: Transaction[] = [coinbaseTx].concat(poolTxs);
    return await generateRawNextBlock(blockData);
};

const generatenextBlockWithTransaction = async (receiverAddress: string, amount: number) => {
    if (!isValidAddress(receiverAddress)) {
        throw Error('invalid address');
    }
    if (typeof amount !== 'number') {
        throw Error('invalid amount');
    }

    const latestBlock = getLatestBlock();
    const nextIndex = latestBlock.index + 1;
    const minterAddress = getPublicFromWallet();

    const tx: Transaction = createTransaction(receiverAddress, amount, getPrivateFromWallet(), getUnspentTxOuts(), getTransactionPool());

    const txFee = getTxFee(tx, getUnspentTxOuts());

    const coinbaseTx: Transaction = getCoinbaseTransaction(minterAddress, nextIndex, txFee);
    const blockData: Transaction[] = [coinbaseTx, tx];
    return await generateRawNextBlock(blockData);
};

const findBlock = (index: number, previousHash: string, data: Transaction[], difficulty: number): Block => {
    const timestamp: number = getCurrentTimestamp();
    const merkleRoot = getMerkleRoot(data);
    const hash: string = calculateHash(index, previousHash, timestamp, merkleRoot, difficulty, getAccountBalance(), getPublicFromWallet());

    if (isBlockStakingValid(previousHash, getPublicFromWallet(), timestamp, getAccountBalance(), difficulty, index)) {
        const currentUTXOs = getUnspentTxOuts();
        const nextUTXOs = processTransactions(data, currentUTXOs, index);
        const nextState = new State(nextUTXOs);
        const stateRoot = nextState.getRoot();

        return new Block(index, hash, previousHash, timestamp, data, merkleRoot, difficulty, getAccountBalance(), getPublicFromWallet(), stateRoot);
    }
    return null;
};

const getAccountBalance = (): number => {
    return getBalance(getPublicFromWallet(), getUnspentTxOuts());
};

const sendTransaction = (address: string, amount: number): Transaction => {
    const tx: Transaction = createTransaction(address, amount, getPrivateFromWallet(), getUnspentTxOuts(), getTransactionPool());
    addToTransactionPool(tx, getUnspentTxOuts());
    broadCastTransactionPool();
    return tx;
};

const calculateHashForBlock = (block: Block): string =>
    calculateHash(block.index, block.previousHash, block.timestamp, block.merkleRoot, block.difficulty, block.minterBalance, block.minterAddress);

const calculateHash = (index: number, previousHash: string, timestamp: number, merkleRoot: string,
    difficulty: number, minterBalance: number, minterAddress: string): string =>
    CryptoJS.SHA256(index + previousHash + timestamp + merkleRoot + difficulty + minterBalance + minterAddress).toString();

const isValidBlockStructure = (block: Block): boolean => {
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

const isValidBlockHeader = (newBlock: Block, previousBlock: Block): boolean => {
    if (!isValidBlockStructure(newBlock)) {
        console.log('invalid block structure: %s', JSON.stringify(newBlock));
        return false;
    }
    if (previousBlock.index + 1 !== newBlock.index) {
        console.log('invalid index');
        return false;
    } else if (previousBlock.hash !== newBlock.previousHash) {
        console.log('invalid previoushash');
        return false;
    } else if (!isValidTimestamp(newBlock, previousBlock)) {
        console.log('invalid timestamp');
        return false;
    } else if (!hasValidHash(newBlock)) {
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

const isValidNewBlock = (newBlock: Block, previousBlock: Block): boolean => {
    if (!isValidBlockHeader(newBlock, previousBlock)) {
        return false;
    }
    if (getMerkleRoot(newBlock.data) !== newBlock.merkleRoot) {
        console.log('invalid merkle root');
        return false;
    }
    return true;
};

const getAccumulatedDifficulty = (aBlockchain: Block[]): BigNumber => {
    return aBlockchain
        .reduce((sum, block) => sum.plus(new BigNumber(2).exponentiatedBy(block.difficulty)), new BigNumber(0));
};

const isValidTimestamp = (newBlock: Block, previousBlock: Block): boolean => {
    return (previousBlock.timestamp - 60 < newBlock.timestamp)
        && newBlock.timestamp - 60 < getCurrentTimestamp();
};

const hasValidHash = (block: Block): boolean => {

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

const hashMatchesBlockContent = (block: Block): boolean => {
    const blockHash: string = calculateHashForBlock(block);
    return blockHash === block.hash;
};

const isBlockStakingValid = (prevhash: string, address: string, timestamp: number, balance: number, difficulty: number, index: number): boolean => {
    difficulty = difficulty + 1;

    if (index <= mintingWithoutCoinIndex) {
        balance = balance + 1;
    }

    const balanceOverDifficulty = TWO_POW_256.times(balance).dividedBy(difficulty);
    const stakingHash: string = CryptoJS.SHA256(prevhash + address + timestamp).toString();
    const decimalStakingHash = new BigNumber(stakingHash, 16);
    const difference = balanceOverDifficulty.minus(decimalStakingHash).toNumber();

    return difference >= 0;
};

const isValidChain = async (blockchainToValidate: Block[]): Promise<UnspentTxOut[]> => {
    console.log('isValidChain:');
    console.log(JSON.stringify(blockchainToValidate));
    const isValidGenesis = (block: Block): boolean => {
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

    let aUnspentTxOuts: UnspentTxOut[] = [];

    for (let i = 0; i < blockchainToValidate.length; i++) {
        if (i % 10 === 0) {
            await yieldToEventLoop();
        }

        const currentBlock: Block = blockchainToValidate[i];

        let currentState: State;
        if (i === 0) {
            const genesisUTXOs = processTransactions(currentBlock.data, [], 0);
            currentState = new State(genesisUTXOs);
            if (currentBlock.stateRoot && currentBlock.stateRoot !== currentState.getRoot()) {
                throw new ValidationError('Genesis State Root mismatch', ValidationErrorCode.INVALID_BLOCK_HASH, true);
            }
            aUnspentTxOuts = genesisUTXOs;
        } else {
            currentState = new State(aUnspentTxOuts);

            if (!isValidNewBlock(currentBlock, blockchainToValidate[i - 1])) {
                console.log('isValidChain: Block ' + i + ' is invalid compared to block ' + (i - 1));
                return null;
            }

            try {
                const newState = await BlockExecutor.executeBlock(currentBlock, currentState);
                aUnspentTxOuts = newState.getUnspentTxOuts();
            } catch (e) {
                console.log('Invalid block execution at index ' + i + ': ' + e.message);
                if (e instanceof ValidationError && e.shouldBan) throw e;
                return null;
            }
        }
    }
    return aUnspentTxOuts;
};

const addBlockToChain = async (newBlock: Block): Promise<boolean> => {
    if (isValidNewBlock(newBlock, getLatestBlock())) {
        try {
            const currentState = new State(getUnspentTxOuts());
            const newState = await BlockExecutor.executeBlock(newBlock, currentState);
            const retVal = newState.getUnspentTxOuts();

            blockchain.push(newBlock);
            setUnspentTxOuts(retVal);
            updateTransactionPool(unspentTxOuts);
            saveBlockchain();
            return true;
        } catch (e) {
            console.log('block execution failed', e);
            if (e instanceof ValidationError && e.shouldBan) throw e;
            return false;
        }
    } else {
        return false;
    }
};

const getCumulativeDifficulty = (aBlockchain: Block[]): BigNumber => {
    return aBlockchain
        .map((block) => new BigNumber(block.difficulty))
        .reduce((a, b) => a.plus(b), new BigNumber(0));
};

const replaceChain = async (newBlocks: Block[]) => {
    const newUnspentTxOuts = await isValidChain(newBlocks);
    if (newUnspentTxOuts !== null &&
        getCumulativeDifficulty(newBlocks).gt(getCumulativeDifficulty(blockchain))) {
        console.log('Received blockchain is valid. Replacing current blockchain with received blockchain');

        blockchain = newBlocks;
        setUnspentTxOuts(newUnspentTxOuts);
        updateTransactionPool(unspentTxOuts);
        broadcastLatest();
        saveBlockchain();
    } else {
        console.log('Received blockchain invalid or not heavier');
    }
};

const handleReceivedTransaction = (transaction: Transaction) => {
    addToTransactionPool(transaction, getUnspentTxOuts());
};

const getTotalSupply = (): number => {
    return getUnspentTxOuts()
        .map((uTxO) => uTxO.amount)
        .reduce((a, b) => a + b, 0);
};

const getAllBalances = (): object => {
    const balances = {};
    getUnspentTxOuts().forEach((uTxO) => {
        if (!balances[uTxO.address]) {
            balances[uTxO.address] = 0;
        }
        balances[uTxO.address] += uTxO.amount;
    });
    return balances;
};

export {
    Block, getBlockchain, getUnspentTxOuts, getLatestBlock, sendTransaction,
    generateRawNextBlock, generateNextBlock, generatenextBlockWithTransaction,
    handleReceivedTransaction, getMyUnspentTransactionOutputs,
    getAccountBalance,
    isValidBlockStructure,
    replaceChain,
    addBlockToChain,
    getCumulativeDifficulty,
    initGenesisBlock,
    getBlockHeaders, isValidBlockHeader,
    getTotalSupply, getAllBalances
};
