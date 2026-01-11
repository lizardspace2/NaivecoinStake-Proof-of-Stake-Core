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
const bodyParser = require("body-parser");
const express = require("express");
const _ = require("lodash");
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
    const app = express();
    app.set('etag', false);
    app.use(bodyParser.json());
    app.use((err, req, res, next) => {
        if (err) {
            res.status(400).send(err.message);
        }
    });
    app.get('/blocks', (req, res) => {
        res.send(blockchain_1.getBlockchain());
    });
    app.get('/block/:hash', (req, res) => {
        const block = _.find(blockchain_1.getBlockchain(), { 'hash': req.params.hash });
        res.send(block);
    });
    app.get('/block/index/:index', (req, res) => {
        const block = _.find(blockchain_1.getBlockchain(), { 'index': parseInt(req.params.index) });
        res.send(block);
    });
    app.get('/blocks/:from/:to', (req, res) => {
        const from = parseInt(req.params.from);
        const to = parseInt(req.params.to);
        const blocks = blockchain_1.getBlockHeaders(from, to);
        res.send(blocks);
    });
    app.get('/transaction/:id', (req, res) => {
        const tx = _(blockchain_1.getBlockchain())
            .map((blocks) => blocks.data)
            .flatten()
            .find({ 'id': req.params.id });
        res.send(tx);
    });
    app.get('/address/:address', (req, res) => {
        const unspentTxOuts = _.filter(blockchain_1.getUnspentTxOuts(), (uTxO) => uTxO.address === req.params.address);
        res.send({ 'unspentTxOuts': unspentTxOuts });
    });
    app.get('/unspentTransactionOutputs', (req, res) => {
        res.send(blockchain_1.getUnspentTxOuts());
    });
    app.get('/totalSupply', (req, res) => {
        res.send({ 'supply': blockchain_1.getTotalSupply() });
    });
    app.get('/addresses', (req, res) => {
        res.send(blockchain_1.getAllBalances());
    });
    app.get('/myUnspentTransactionOutputs', (req, res) => {
        res.send(blockchain_1.getMyUnspentTransactionOutputs());
    });
    app.post('/mintRawBlock', checkSafeMode, (req, res) => __awaiter(this, void 0, void 0, function* () {
        if (req.body.data == null) {
            res.send('data parameter is missing');
            return;
        }
        const newBlock = yield blockchain_1.generateRawNextBlock(req.body.data);
        if (newBlock === null) {
            res.status(400).send('could not generate block');
        }
        else {
            res.send(newBlock);
        }
    }));
    app.post('/mintBlock', checkSafeMode, (req, res) => __awaiter(this, void 0, void 0, function* () {
        const newBlock = yield blockchain_1.generateNextBlock();
        if (newBlock === null) {
            res.status(400).send('could not generate block');
        }
        else {
            res.send(newBlock);
        }
    }));
    app.get('/balance', (req, res) => {
        const balance = blockchain_1.getAccountBalance();
        res.send({ 'balance': balance });
    });
    app.get('/address', (req, res) => {
        const address = wallet_1.getPublicFromWallet();
        res.send({ 'address': address });
    });
    app.post('/mintTransaction', checkSafeMode, (req, res) => __awaiter(this, void 0, void 0, function* () {
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
            const resp = yield blockchain_1.generatenextBlockWithTransaction(address, amount);
            res.send(resp);
        }
        catch (e) {
            console.log('mintTransaction error: ' + e.message);
            res.status(400).send(e.message);
        }
    }));
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
            const resp = blockchain_1.sendTransaction(address, amount);
            res.send(resp);
        }
        catch (e) {
            console.log('sendTransaction error: ' + e.message);
            res.status(400).send(e.message);
        }
    });
    app.get('/transactionPool', (req, res) => {
        res.send(transactionPool_1.getTransactionPool());
    });
    app.post('/transactionPool', checkSafeMode, (req, res) => {
        try {
            const tx = req.body;
            blockchain_1.handleReceivedTransaction(tx);
            p2p_1.broadCastTransactionPool();
            res.send('transaction added to pool');
        }
        catch (e) {
            console.log('transactionPool error: ' + e.message);
            res.status(400).send(e.message);
        }
    });
    app.get('/peers', (req, res) => {
        res.send(p2p_1.getSockets().map((s) => s._socket.remoteAddress + ':' + s._socket.remotePort));
    });
    app.post('/addPeer', checkSafeMode, (req, res) => {
        p2p_1.connectToPeers(req.body.peer);
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
    setInterval(() => __awaiter(this, void 0, void 0, function* () {
        try {
            if (blockchain_1.getAccountBalance() > 0) {
                const newBlock = yield blockchain_1.generateNextBlock();
                if (newBlock) {
                    console.log(`Auto-generation: Mined block ${newBlock.index}`);
                }
            }
        }
        catch (e) {
            console.log('Auto-mining error:', e.message);
        }
    }), interval);
};
wallet_1.initDilithium().then(() => {
    blockchain_1.initGenesisBlock();
    wallet_1.initWallet();
    initHttpServer(httpPort);
    p2p_1.initP2PServer(p2pPort);
    initAutoMining();
    const bootNodes = ['ws://34.66.32.62:6001'];
    let peers = bootNodes;
    if (process.env.PEERS) {
        const customPeers = process.env.PEERS.split(',');
        peers = [...peers, ...customPeers];
    }
    peers = [...new Set(peers)];
    console.log('Connect to peers: ' + peers);
    peers.forEach((peer) => {
        p2p_1.connectToPeers(peer);
    });
    console.log('Quantix post-quantum cryptography initialized');
}).catch((error) => {
    console.error('Failed to initialize Quantix core:', error);
    process.exit(1);
});
//# sourceMappingURL=main.js.map
