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

const GENESIS_ADDRESS = '6e5c3e1fcc71c4afda2abe2ee073d320aca5bb772647f3d5ee8c0dfe96807a627c8f3e9e80eebece49f6987b4faecf0e9f24320b00ea6c431e8de6e335f85dc543357805adb9d142c331fe3675ca5741f0cd7d5c827a8fdd6550aec7ed645ae8aa5023052a1a39394190add5c14bcc75df5211a30c4906dde31e5b27d1a9febd2319dbc8cdba7e35a014b695a609be4640573f167d0b680157df1a8a145dce32e932dab78b56cbf43307fd676bde120affacd97eb1ea5412feac908bd21738e32e64db602100dba3ef153501e9f96a93e5a582da395fc17ad075a44db4f50f937303c12769409836f29eadb2e8fe17eb206d4bddf1d8c36b6e136f5162da14a01251ba204c4fd0016e1cd03b643c9af3e17488e998daa27a92ae7b0d27e6a97c3f155feea556f2bc874c6e8a68aaef995d069a27a2ca80bb619902c74f1dd28d99b09c29ce010a86c9a2c84f726ba59fd7f65450c3b4c303dfbcfb3b170d41e0c0d5f48a914146fb79346a885cd52b4034c97fe58274805e4a82b62f3217ec479524476e767ea89c4b69f9ae980d715be57929b04ed5652fd53210f3321994ee1fcb5c2468370b8efd7ea7da8568a62aa82e8f29e7195074ae8ae88ba4b3107a86ad7a1964ce96742cc1d6036a694677d0327c5ae414cfcafc96801f4776e528e4514d3c215dac619929192cb01f73d8096536da72b3f3750e667e4e0cf71b10a3682fb7646be6f81eba6ba0b5e93211dd65cd4101fd701aac771dc71470b7986ccff225c64eb109ad444dce1988165c82ad5fec6e4e248aaecc96c427dbea04abe5b0a05cb0b139a8c2c0542e0ce7a7a5e81864f5911d8c7c33ebb468b0ba6426d7808d14d42d13a9f8887fa0ec72a0df33e0ca71d87dae5c9eb3cb2745f812569a422d9376d8b2ec00dcf36d1777c21dcc782e0ae8c3939baa6fa14e47ef52d13a7d533579856711432aec403b3bd44f0dc84280d988e23e1dc9c9a0072f57dc10c94e3a23b2eb370e6769b6b8f94a00a07265c3bec3907dc6ec91e70236bec7a715adcadb4912d3f4f3cbec228c00cfe94fcbed7a94efd720e6a3b784b7993e83f127d70a976a884faf460bb4bdc64f180320c9e988d823d5d2e92ea98322ca0483cf4f511c7801de219b8e6849fbcfb0bd88b768b394e0c9750160235340a0f9b3af13585cd115f1054c3eb81d02124cfdc3fc26ef1d646c07a0d2947a5f45662061b642ab181dc078e03debd1e6127a41e11982134e2173ccff75353aea7d15a2744925bc5de3e204e28dccdf19e324af74c50ec51db7cc96242d3c7b25424cb6c8dd481defcb780699fecc4e2163c0de18815d4cefe8df21ebf8bbd97992698ec0e1e4358b7b33af584e1d55f375442e38b3081c2b6effde3f9a5b9116708b929f045f86296ecf5252b8aa90aae49a2ed1add27f68449c0e85f7256f91b455745cdfd1068c9a28eeed26fc20cec57f0ab5df9e298324a1049acd87daacb6cda5a4538d3d83a59cc0424e3489c05211df554299a912cb4149da3c009dfc2b7b22ad98efd397cd7a009aaee786af8c87612190392fde2407a1f78d7cc86ac4b55566fcfcbf2f70f6ec0274399b638a05959afa07503b3893db5b42b79e3c3029fc5e7db3dbe192f46be512c4555d0c4b3f27a32faf0c609c03cef5735ab2364469b2148fa7faa866601999bd2edee54d7c1c6ba975d465b90a9038883d639e69378976be07f74c9cda564aa1580ab7019caafcf9c4c0e352c57df0d1566507d93515a2f215deafb1d7cb1076e57c864b744fd0c4bb18ca282106cf93b701043efd78ab034b83934522b2f54e9bd722b062ee4f5e78b7d7b8e71c5ee023aa267d506682f899ce6867b833aff3c5456931c0875e98a79cfbffb78444fd0e0fd0698b5c5bbb5f5aed4b048bb40e4b5af5e25e9dff8d0a39e76fff860e9a0d3d7eabb05650f3231327c6e9fbf9fe3e3b2c03446389b4d2e6da991637d90601cfab89c76c2d8403d61ce5c204150c29fe784ed5799c4b4e0355db3c6412fd68d4c4b09eddb4d342291a0ab3c92e952b480201b065ce02494eb2793a24b2b96873986b839f518fab26fed3140ce3077c7ba1f1c15215d212eed0833fda92d7f2ab0982be4dfadae5b994a79d15995b694f7a1d1ec7dd3c52d858b6da607248d0d72ffaba6f6456577630dacdb4c6ac832280f6ded8bd7fb5a6ec72f51d798801782516312b0bd461d5234917e31bfca01d8683aeabcfe7583a0226bdd9de538f186c57ecf7d450af387b232869f143d927304c8197280daa3e303d9310b04809d2471fb3df3001f9ced640c6488f8855772cc83a0815936d6edb0eab9db7eb0060f9a99a62ebcc5eba7c0b37c587019276b0163d8fe0a7df02a4a61ff6d80cc3e69723f513c51f043fbf2eb40cf761adc5641ad73091103209bd2f73479ab33c84c3ca28fe13607d49c1d1fc7b362604f90b84479f4d7464430c8a3c7996344d22f9213de422bd52d9e23ac6d2a7e946de170b6e3d4f648c1c3bfaf921e7dc1bdeb781ca7770dd1d434b902cccd0007285c34b88edfa067852a37ed85628786221d5f34499655507216d84a1083c1f171781af087cc95de8a07896b77c77b6765bfadc5ca2a9cf470d198aaad85da863d415bd55f2dc62aa4a1864acec02370e38c2cc5b4a8dd038bb7357781bd259f1d72883c1a120ec2585ec906b7104a1dee48b7707887dbd42a3ac66110e40ee7a07814701889cac0ce2f8556612cfa9817d';

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
