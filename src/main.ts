import * as  bodyParser from 'body-parser';
import * as express from 'express';
import * as _ from 'lodash';
import {
    Block, generateNextBlock, generatenextBlockWithTransaction, generateRawNextBlock, getAccountBalance,
    getBlockchain, getBlockHeaders, getMyUnspentTransactionOutputs, getUnspentTxOuts, sendTransaction, initGenesisBlock,
    getTotalSupply, getAllBalances
} from './blockchain';
import { connectToPeers, getSockets, initP2PServer } from './p2p';
import { UnspentTxOut } from './transaction';
import { getTransactionPool } from './transactionPool';
import { getPublicFromWallet, initWallet, initDilithium } from './wallet';

const httpPort: number = parseInt(process.env.HTTP_PORT) || 3001;
const p2pPort: number = parseInt(process.env.P2P_PORT) || 6001;
const safeMode: boolean = process.env.SAFE_MODE === 'true';

const checkSafeMode = (req, res, next) => {
    if (safeMode) {
        res.status(403).send('Endpoint disabled in safe mode');
        return;
    }
    next();
};

const initHttpServer = (myHttpPort: number) => {
    const app = express();
    app.set('etag', false);
    app.use(bodyParser.json());

    app.use((err, req, res, next) => {
        if (err) {
            res.status(400).send(err.message);
        }
    });

    app.get('/blocks', (req, res) => {
        res.send(getBlockchain());
    });

    app.get('/block/:hash', (req, res) => {
        const block = _.find(getBlockchain(), { 'hash': req.params.hash });
        res.send(block);
    });

    app.get('/block/index/:index', (req, res) => {
        const block = _.find(getBlockchain(), { 'index': parseInt(req.params.index) });
        res.send(block);
    });

    app.get('/blocks/:from/:to', (req, res) => {
        const from = parseInt(req.params.from);
        const to = parseInt(req.params.to);
        const blocks = getBlockHeaders(from, to);
        res.send(blocks);
    });

    app.get('/transaction/:id', (req, res) => {
        const tx = _(getBlockchain())
            .map((blocks) => blocks.data)
            .flatten()
            .find({ 'id': req.params.id });
        res.send(tx);
    });

    app.get('/address/:address', (req, res) => {
        const unspentTxOuts: UnspentTxOut[] =
            _.filter(getUnspentTxOuts(), (uTxO) => uTxO.address === req.params.address);
        res.send({ 'unspentTxOuts': unspentTxOuts });
    });

    app.get('/unspentTransactionOutputs', (req, res) => {
        res.send(getUnspentTxOuts());
    });

    app.get('/totalSupply', (req, res) => {
        res.send({ 'supply': getTotalSupply() });
    });

    app.get('/addresses', (req, res) => {
        res.send(getAllBalances());
    });

    app.get('/myUnspentTransactionOutputs', (req, res) => {
        res.send(getMyUnspentTransactionOutputs());
    });

    app.post('/mintRawBlock', checkSafeMode, async (req, res) => {
        if (req.body.data == null) {
            res.send('data parameter is missing');
            return;
        }
        const newBlock: Block = await generateRawNextBlock(req.body.data);
        if (newBlock === null) {
            res.status(400).send('could not generate block');
        } else {
            res.send(newBlock);
        }
    });

    app.post('/mintBlock', checkSafeMode, async (req, res) => {
        const newBlock: Block = await generateNextBlock();
        if (newBlock === null) {
            res.status(400).send('could not generate block');
        } else {
            res.send(newBlock);
        }
    });

    app.get('/balance', (req, res) => {
        const balance: number = getAccountBalance();
        res.send({ 'balance': balance });
    });

    app.get('/address', (req, res) => {
        const address: string = getPublicFromWallet();
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
            const resp = await generatenextBlockWithTransaction(address, amount);
            res.send(resp);
        } catch (e) {
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
            const resp = sendTransaction(address, amount);
            res.send(resp);
        } catch (e) {
            console.log('sendTransaction error: ' + e.message);
            res.status(400).send(e.message);
        }
    });

    app.get('/transactionPool', (req, res) => {
        res.send(getTransactionPool());
    });

    app.get('/peers', (req, res) => {
        res.send(getSockets().map((s: any) => s._socket.remoteAddress + ':' + s._socket.remotePort));
    });
    app.post('/addPeer', checkSafeMode, (req, res) => {
        connectToPeers(req.body.peer);
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
            if (getAccountBalance() > 0) {
                const newBlock = await generateNextBlock();
                if (newBlock) {
                    console.log(`Auto-generation: Mined block ${newBlock.index}`);
                }
            }
        } catch (e) {
            console.log('Auto-mining error:', e.message);
        }
    }, interval);
};

initDilithium().then(() => {
    initGenesisBlock();
    initWallet();
    initHttpServer(httpPort);
    initP2PServer(p2pPort);
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
        connectToPeers(peer);
    });
    console.log('Dilithium post-quantum cryptography initialized');
}).catch((error) => {
    console.error('Failed to initialize Dilithium:', error);
    process.exit(1);
});
