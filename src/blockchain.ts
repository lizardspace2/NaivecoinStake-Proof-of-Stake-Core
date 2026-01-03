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
        const genesisAddress = '1e88a889310518d0e31efa533acc8d61708a2f5718909507da5fff1f63102fd72ad8330bbf8bb11c31aa3d44cd1ed83db61ecc00f6e463b8c829d9ec1c837fc115cb6dca5f02416ac6590518d3554760016a80927d0594820f3f90844e836578d2abd547b47b4b0cc4f9edc103bfb0013b8099e108534d28cc3d4034da24537e2e31dc41f6f102a76caad9f528e09de7eb6d7e4b8a76f9e839066f060eff2f57be8d6a9a523e77d87a58790186aafda6a538828302d0800d9ea6172e7882dda0f2b4bbb7ee2841f55221d09ee934a54a6e8ecdec2b73ff3c4f6427e72ec50d93d71858f7c25ac08e53c9d758118e73a3084d0601d791ef811258284eeeb1a64343290ecb1d5f03a82db904b6a75ede78f33d2978303c32ea9d63ebd8c776c7e32b15d14601b94224e5a335bac2d7802c58c3123238ce71feb5e1cdf4eaf719d2cf81f083d47fce539fce2f627c1106fd0168259ba4021e239de7d5b7c4a311ce699a69e1dd318583de98c4b89ef34964dc144f8876c05d26305e7473d5cf848a0321c21a8c4fc255bbf2be32ad67408829ecf636b0b72914e44d168636b9b1a719606b56977a5077df226c1e3135a2df7576f000614ed9a689c7dc156f0dad3ba23a87e19162bcc924c0e7d9b2fe9234834e4fe4443cf085638fd3351ebe6c02866820431339f77859ddef8ca9adaeb64e79a2d411d05f2553c6116c7f7137a8456b1897352383c84e0bfee227cfaf93cf8572ce5c6386612d5a9afd1aa18e0452974a7d5e80301c5c0dcbae74d729ee975c3cb8b4658970f0fb19f81b06ee06b12a846a5f62bb1d14feb958b558e0a1fb8a17f134b8c1e2dc17cd7dad7922c7aaa3ef666c061255ef985470b5c15cbbe2a1b59ff04483f7da8fa7430a1560f77034904984a2e3c2344ec74914f88abf758129f68f5044ca4edb2a7fc068871bddcb18759fcbef48e5c7aeacaae35966f097db8aed5cdf1638eb466739c614fc46b2bdee6766a4d16c8867091e3d73b7c2b6aa38edfcd426fec5b7f7a529c73a0fb4d6ce7ea4c84b7933e39bb747837253e483d4237da4bc5c2a677a92fcf72d61914327142c962688fd0902e553549977f6d427cddc55c40c98dada1b47b13d3b7141fe7b9670e5e05fe30ff297e188252dadaeacda8c3a066f4fcb06bc10c86e749a2a96388f02a6637ec97a2707f29760427dc64c177f8e055c0a14479392679e3323cfe3d66e377e7aabe45ec22f9fef36a8b4ac58d8e114a9c0a44bf5fe90ecba362306d18d0542772546b7a25bed4b118e39685dc7c4972bfd12d61dc94db9385e0786ae49f0896e9c943844dc9d25e14aedc53417a36e639e8a2a6bc9d3aa6917f8e6543a0652c20a6071a66953f9c86bdd64fe7e4ff95333ab500b959535e46757abe7090fe3d0e4c767400f20df82552e28451cca1d3cb5dd40857807d6e6530b17315b64a74b10336b36aba66d2d9202b27db18fc7ac1a9ac4d512048424494fa0d24d0975d80205f0ded4de833f8d4d5e05c285b68865f9a0ee8c47c0940af1ccd8093136a0c62ad4f1ad3cd7288e87bc8fd56d4980799443f592e3a1e7cc4a5add5ec08696f982f60e5d64b3d3f5d02dc09df95788c7484ec320b083671088df619e10c21b723759657e9d282e7419ac99e6ea487c5a49a53e2fe65c1a9ab66c3c7db53f6e15d75cfa968fee3e0f626395b4a6da6c8ea32212196f42cb7546da1e02316e4a8ea083bd9f94e3a4f2ca6a2392d013bb5508385375b580324ef1689f64529486b206492f9b048ee5cf7241159d7a0892f44b097ee96e51a09345abea3573ced133ba065978fbe41fa2a0d00fbb62935e69ff48067e766ec56bc3fe3ef9ab0701769decd8450fdf4573a9f65c9487a569d31a282cbd0ea2613fa5aeb2c1cdc45966952583e86d9018df799d7f52119df7dbfb2d758825b1d6f6aa907d25154734bd78db3a5534dc1ad81b305c219055171fdd8b679e3f0673634b5c0326c2e9c9e01ad1318e7e7f4b9a227388dda1171cc92c8f660a33ae69853f9e6c7e405452a0401410f00b13058b587cd67b56880af618be7352';

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

        console.log('Genesis block initialized with Dilithium address');
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
    const latestBlock: Block = aBlockchain[blockchain.length - 1];
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
