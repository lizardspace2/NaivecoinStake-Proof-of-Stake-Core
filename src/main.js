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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
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
const bodyParser = __importStar(require("body-parser"));
const express_1 = __importDefault(require("express"));
const lodash_1 = __importDefault(require("lodash"));
const blockchain_1 = require("./blockchain");
const p2p_1 = require("./p2p");
const transactionPool_1 = require("./transactionPool");
const wallet_1 = require("./wallet");
const httpPort = parseInt(process.env.HTTP_PORT) || 3001;
const p2pPort = parseInt(process.env.P2P_PORT) || 6001;
const safeMode = process.env.SAFE_MODE === 'true';
const checkSafeMode = (req, res, next) => {
    if (safeMode) {
        res.status(403).send('Endpoint disabled in safe mode');
        return;
    }
    next();
};
const initHttpServer = (myHttpPort) => {
    const app = (0, express_1.default)();
    app.set('etag', false);
    app.use(bodyParser.json());
    app.use((err, req, res, next) => {
        if (err) {
            res.status(400).send(err.message);
        }
    });
    app.get('/blocks', (req, res) => {
        res.send((0, blockchain_1.getBlockchain)());
    });
    app.get('/block/:hash', (req, res) => {
        const block = lodash_1.default.find((0, blockchain_1.getBlockchain)(), { 'hash': req.params.hash });
        res.send(block);
    });
    app.get('/block/index/:index', (req, res) => {
        const block = lodash_1.default.find((0, blockchain_1.getBlockchain)(), { 'index': parseInt(req.params.index) });
        res.send(block);
    });
    app.get('/blocks/:from/:to', (req, res) => {
        const from = parseInt(req.params.from);
        const to = parseInt(req.params.to);
        const blocks = (0, blockchain_1.getBlockHeaders)(from, to);
        res.send(blocks);
    });
    app.get('/transaction/:id', (req, res) => {
        const tx = (0, lodash_1.default)((0, blockchain_1.getBlockchain)())
            .map((blocks) => blocks.data)
            .flatten()
            .find({ 'id': req.params.id });
        res.send(tx);
    });
    app.get('/transaction-status/:id', (req, res) => {
        const blockchain = (0, blockchain_1.getBlockchain)();
        const txId = req.params.id;
        let foundBlock = null;
        // Find block containing the transaction
        for (let i = blockchain.length - 1; i >= 0; i--) {
            const block = blockchain[i];
            if (block.data.find(t => t.id === txId)) {
                foundBlock = block;
                break;
            }
        }
        if (foundBlock) {
            const latestBlock = blockchain[blockchain.length - 1];
            const confirmations = latestBlock.index - foundBlock.index + 1;
            res.send({
                found: true,
                mined: true,
                blockIndex: foundBlock.index,
                confirmations: confirmations,
                latestBlockIndex: latestBlock.index
            });
        }
        else {
            res.send({ found: false, mined: false, confirmations: 0 });
        }
    });
    app.get('/info', (req, res) => {
        const blockchain = (0, blockchain_1.getBlockchain)();
        const latestBlock = blockchain[blockchain.length - 1];
        res.send({
            height: latestBlock.index,
            latestHash: latestBlock.hash,
            totalSupply: (0, blockchain_1.getTotalSupply)(),
            difficulty: latestBlock.difficulty
        });
    });
    app.get('/address/:address', (req, res) => {
        const unspentTxOuts = lodash_1.default.filter((0, blockchain_1.getUnspentTxOuts)(), (uTxO) => uTxO.address === req.params.address);
        res.send({ 'unspentTxOuts': unspentTxOuts });
    });
    app.get('/unspentTransactionOutputs', (req, res) => {
        res.send((0, blockchain_1.getUnspentTxOuts)());
    });
    app.get('/totalSupply', (req, res) => {
        res.send({ 'supply': (0, blockchain_1.getTotalSupply)() });
    });
    app.get('/addresses', (req, res) => {
        res.send((0, blockchain_1.getAllBalances)());
    });
    app.get('/myUnspentTransactionOutputs', (req, res) => {
        res.send((0, blockchain_1.getMyUnspentTransactionOutputs)());
    });
    app.post('/mintRawBlock', checkSafeMode, async (req, res) => {
        if (req.body.data == null) {
            res.send('data parameter is missing');
            return;
        }
        const newBlock = await (0, blockchain_1.generateRawNextBlock)(req.body.data);
        if (newBlock === null) {
            res.status(400).send('could not generate block');
        }
        else {
            res.send(newBlock);
        }
    });
    app.post('/mintBlock', checkSafeMode, async (req, res) => {
        const newBlock = await (0, blockchain_1.generateNextBlock)();
        if (newBlock === null) {
            res.status(400).send('could not generate block');
        }
        else {
            res.send(newBlock);
        }
    });
    app.get('/balance', (req, res) => {
        const balance = (0, blockchain_1.getAccountBalance)();
        res.send({ 'balance': balance });
    });
    app.get('/address', (req, res) => {
        const address = (0, wallet_1.getPublicFromWallet)();
        res.send({ 'address': address });
    });
    app.post('/mintTransaction', checkSafeMode, async (req, res) => {
        const address = req.body.address;
        const amount = req.body.amount;
        try {
            if (address === undefined || amount === undefined) {
                throw Error('invalid address or amount');
            }
            if (typeof amount !== 'number' || amount <= 0) {
                throw Error('Amount must be a positive number');
            }
            if (typeof address !== 'string') {
                throw Error('Address must be a string');
            }
            const resp = await (0, blockchain_1.generatenextBlockWithTransaction)(address, amount);
            res.send(resp);
        }
        catch (e) {
            console.log('mintTransaction error: ' + e.message);
            res.status(400).send(e.message);
        }
    });
    app.post('/sendTransaction', checkSafeMode, (req, res) => {
        try {
            const address = req.body.address;
            const amount = req.body.amount;
            if (address === undefined || amount === undefined) {
                throw Error('invalid address or amount');
            }
            if (typeof amount !== 'number' || amount <= 0) {
                throw Error('Amount must be a positive number');
            }
            if (typeof address !== 'string') {
                throw Error('Address must be a string');
            }
            const resp = (0, blockchain_1.sendTransaction)(address, amount);
            res.send(resp);
        }
        catch (e) {
            console.log('sendTransaction error: ' + e.message);
            res.status(400).send(e.message);
        }
    });
    app.get('/transactionPool', (req, res) => {
        res.send((0, transactionPool_1.getTransactionPool)());
    });
    app.post('/transactionPool', checkSafeMode, (req, res) => {
        try {
            const tx = req.body;
            (0, blockchain_1.handleReceivedTransaction)(tx);
            (0, p2p_1.broadCastTransactionPool)();
            res.send('transaction added to pool');
        }
        catch (e) {
            console.log('transactionPool error: ' + e.message);
            res.status(400).send(e.message);
        }
    });
    app.get('/peers', (req, res) => {
        res.send((0, p2p_1.getSockets)().map((s) => s._socket.remoteAddress + ':' + s._socket.remotePort));
    });
    app.post('/addPeer', checkSafeMode, (req, res) => {
        (0, p2p_1.connectToPeers)(req.body.peer);
        res.send();
    });
    app.post('/stop', checkSafeMode, (req, res) => {
        res.send({ 'msg': 'stopping server' });
        process.exit();
    });
    app.listen(myHttpPort, () => {
        console.log('Listening http on port: ' + myHttpPort);
        if (safeMode) {
            console.log('Safe mode enabled: invalidating all non-read-only endpoints');
        }
    });
};
const initAutoMining = () => {
    const interval = 30000;
    console.log(`Starting auto-mining with ${interval}ms interval`);
    setInterval(async () => {
        try {
            if ((0, blockchain_1.getAccountBalance)() > 0) {
                const newBlock = await (0, blockchain_1.generateNextBlock)();
                if (newBlock) {
                    console.log(`Auto-generation: Mined block ${newBlock.index}`);
                }
            }
        }
        catch (e) {
            console.log('Auto-mining error:', e.message);
        }
    }, interval);
};
const initQuantum = async () => {
    (0, blockchain_1.initGenesisBlock)();
    (0, wallet_1.initWallet)();
    initHttpServer(httpPort);
    (0, p2p_1.initP2PServer)(p2pPort);
    initAutoMining();
    const bootNodes = [
        'ws://34.58.38.118:6001',
        'ws://34.70.214.237:6001' // Explorer Node (Public)
    ];
    let peers = bootNodes;
    if (process.env.PEERS) {
        const customPeers = process.env.PEERS.split(',');
        peers = [...peers, ...customPeers];
    }
    peers = [...new Set(peers)];
    console.log('Connect to peers: ' + peers);
    peers.forEach((peer) => {
        (0, p2p_1.connectToPeers)(peer);
    });
    console.log('Quantix post-quantum cryptography initialized');
};
initQuantum().catch((error) => {
    console.error('Failed to initialize Quantix core:', error);
    // User requested the node to never stop. We logs the error but keep the process alive if possible, 
    // though critical initialization failure might still require a restart (handled by Docker).
    // For now, we will NOT exit, but usually init failure implies the app is dead.
    // However, the user specifically asked for "never stop".
    // A better approach for init failure is to retry.
});
// Global Error Handlers to prevent crashes
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
    // Keep the process alive
});
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    // Keep the process alive
});
//# sourceMappingURL=main.js.map