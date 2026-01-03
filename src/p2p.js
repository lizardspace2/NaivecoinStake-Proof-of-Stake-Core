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
const WebSocket = require("ws");
const blockchain_1 = require("./blockchain");
const transactionPool_1 = require("./transactionPool");
const validation_errors_1 = require("./validation_errors");
const peerManager_1 = require("./peerManager");
const sockets = [];
const knownPeers = new Set();
const pendingPeers = new Set();
var MessageType;
(function (MessageType) {
    MessageType[MessageType["QUERY_LATEST"] = 0] = "QUERY_LATEST";
    MessageType[MessageType["QUERY_ALL"] = 1] = "QUERY_ALL";
    MessageType[MessageType["RESPONSE_BLOCKCHAIN"] = 2] = "RESPONSE_BLOCKCHAIN";
    MessageType[MessageType["QUERY_TRANSACTION_POOL"] = 3] = "QUERY_TRANSACTION_POOL";
    MessageType[MessageType["RESPONSE_TRANSACTION_POOL"] = 4] = "RESPONSE_TRANSACTION_POOL";
    MessageType[MessageType["QUERY_HEADERS"] = 5] = "QUERY_HEADERS";
    MessageType[MessageType["RESPONSE_HEADERS"] = 6] = "RESPONSE_HEADERS";
    MessageType[MessageType["QUERY_BLOCK_DATA"] = 7] = "QUERY_BLOCK_DATA";
    MessageType[MessageType["RESPONSE_BLOCK_DATA"] = 8] = "RESPONSE_BLOCK_DATA";
})(MessageType || (MessageType = {}));
class Message {
}
const initP2PServer = (p2pPort) => {
    const server = new WebSocket.Server({ port: p2pPort });
    server.on('connection', (ws, req) => {
        const ip = req.socket.remoteAddress;
        if (peerManager_1.peerManager.isBanned(ip)) {
            console.log('Rejected connection from banned peer: ' + ip);
            ws.close();
            return;
        }
        initConnection(ws);
    });
    console.log('listening websocket p2p port on: ' + p2pPort);
    // Keep-alive/Reconnection loop
    setInterval(() => {
        knownPeers.forEach((peer) => {
            const isConnected = sockets.find((s) => s.url === peer);
            if (!isConnected && !pendingPeers.has(peer)) {
                console.log('Reconnecting to peer: ' + peer);
                connectToPeers(peer);
            }
        });
    }, 5000);
};
exports.initP2PServer = initP2PServer;
const getSockets = () => sockets;
exports.getSockets = getSockets;
const initConnection = (ws) => {
    sockets.push(ws);
    initMessageHandler(ws);
    initErrorHandler(ws);
    write(ws, queryChainLengthMsg());
    setTimeout(() => {
        broadcast(queryTransactionPoolMsg());
    }, 500);
};
const JSONToObject = (data) => {
    try {
        return JSON.parse(data);
    }
    catch (e) {
        console.log(e);
        return null;
    }
};
const initMessageHandler = (ws) => {
    ws.on('message', (data) => {
        try {
            const message = JSONToObject(data);
            if (message === null) {
                console.log('could not parse received JSON message: ' + data);
                return;
            }
            console.log('Received message: %s', JSON.stringify(message));
            if (message.type === MessageType.QUERY_LATEST) {
                write(ws, responseLatestMsg());
            }
            else if (message.type === MessageType.QUERY_ALL) {
                write(ws, responseChainMsg());
            }
            else if (message.type === MessageType.RESPONSE_BLOCKCHAIN) {
                const receivedBlocks = JSONToObject(message.data);
                if (receivedBlocks === null) {
                    console.log('invalid blocks received: %s', JSON.stringify(message.data));
                    return;
                }
                console.log('Received blockchain response. Count: ' + receivedBlocks.length);
                if (receivedBlocks.length > 0) {
                    console.log('Range: ' + receivedBlocks[0].index + ' -> ' + receivedBlocks[receivedBlocks.length - 1].index);
                }
                handleBlockchainResponse(receivedBlocks, ws);
            }
            else if (message.type === MessageType.QUERY_TRANSACTION_POOL) {
                write(ws, responseTransactionPoolMsg());
            }
            else if (message.type === MessageType.RESPONSE_TRANSACTION_POOL) {
                const receivedTransactions = JSONToObject(message.data);
                if (receivedTransactions === null) {
                    console.log('invalid transaction received: %s', JSON.stringify(message.data));
                    return;
                }
                receivedTransactions.forEach((transaction) => {
                    try {
                        blockchain_1.handleReceivedTransaction(transaction);
                        broadcast(responseTransactionPoolMsg());
                    }
                    catch (e) {
                        console.log(e.message);
                    }
                });
            }
            else if (message.type === MessageType.QUERY_HEADERS) {
                write(ws, responseHeadersMsg());
            }
            else if (message.type === MessageType.RESPONSE_HEADERS) {
                const receivedHeaders = JSONToObject(message.data);
                if (receivedHeaders === null) {
                    console.log('invalid headers received: %s', JSON.stringify(message.data));
                    return;
                }
                handleBinHeadersResponse(receivedHeaders, ws);
            }
        }
        catch (e) {
            console.log(e);
        }
    });
};
const write = (ws, message) => ws.send(JSON.stringify(message));
const broadcast = (message) => sockets.forEach((socket) => write(socket, message));
const queryChainLengthMsg = () => ({ 'type': MessageType.QUERY_LATEST, 'data': null });
const queryAllMsg = () => ({
    'type': MessageType.QUERY_ALL,
    'data': null
});
const responseChainMsg = () => ({
    'type': MessageType.RESPONSE_BLOCKCHAIN, 'data': JSON.stringify(blockchain_1.getBlockchain())
});
const responseLatestMsg = () => ({
    'type': MessageType.RESPONSE_BLOCKCHAIN,
    'data': JSON.stringify([blockchain_1.getLatestBlock()])
});
const queryTransactionPoolMsg = () => ({
    'type': MessageType.QUERY_TRANSACTION_POOL,
    'data': null
});
const responseTransactionPoolMsg = () => ({
    'type': MessageType.RESPONSE_TRANSACTION_POOL,
    'data': JSON.stringify(transactionPool_1.getTransactionPool())
});
const queryHeadersMsg = () => ({
    'type': MessageType.QUERY_HEADERS,
    'data': null
});
const responseHeadersMsg = () => ({
    'type': MessageType.RESPONSE_HEADERS,
    'data': JSON.stringify(blockchain_1.getBlockHeaders(0, blockchain_1.getBlockchain().length))
});
const initErrorHandler = (ws) => {
    const closeConnection = (myWs) => {
        console.log('connection failed to peer: ' + myWs.url);
        sockets.splice(sockets.indexOf(myWs), 1);
    };
    ws.on('close', () => closeConnection(ws));
    ws.on('error', () => closeConnection(ws));
};
const banPeer = (ws, reason) => {
    const ip = ws._socket.remoteAddress;
    console.log(`Banning peer ${ip} for: ${reason}`);
    peerManager_1.peerManager.banPeer(ip);
    ws.close();
};
const punishPeer = (ws, penaltyType) => {
    const ip = ws._socket.remoteAddress;
    if (penaltyType === 'BLOCK')
        peerManager_1.peerManager.punishInvalidBlock(ip);
    else if (penaltyType === 'TX')
        peerManager_1.peerManager.punishInvalidTransaction(ip);
    else if (penaltyType === 'SPAM')
        peerManager_1.peerManager.punishSpam(ip);
    if (peerManager_1.peerManager.isBanned(ip)) {
        ws.close();
    }
};
const handleBlockchainResponse = (receivedBlocks, ws) => __awaiter(this, void 0, void 0, function* () {
    if (receivedBlocks.length === 0) {
        console.log('received block chain size of 0');
        return;
    }
    const latestBlockReceived = receivedBlocks[receivedBlocks.length - 1];
    if (!blockchain_1.isValidBlockStructure(latestBlockReceived)) {
        console.log('block structuture not valid');
        return;
    }
    const latestBlockHeld = blockchain_1.getLatestBlock();
    if (latestBlockReceived.index > latestBlockHeld.index) {
        console.log('blockchain possibly behind. We got: '
            + latestBlockHeld.index + ' Peer got: ' + latestBlockReceived.index);
        if (latestBlockHeld.hash === latestBlockReceived.previousHash) {
            try {
                if (yield blockchain_1.addBlockToChain(latestBlockReceived)) {
                    broadcast(responseLatestMsg());
                }
            }
            catch (e) {
                if (e instanceof validation_errors_1.ValidationError && e.shouldBan) {
                    banPeer(ws, e.message);
                    return;
                }
                punishPeer(ws, 'BLOCK');
                console.log('Error adding block: ' + e.message);
            }
        }
        else if (receivedBlocks.length === 1) {
            console.log('We have to query the chain from our peer');
            broadcast(queryHeadersMsg());
        }
        else {
            console.log('Received blockchain is longer than current blockchain');
            try {
                yield blockchain_1.replaceChain(receivedBlocks);
            }
            catch (e) {
                if (e instanceof validation_errors_1.ValidationError && e.shouldBan) {
                    banPeer(ws, e.message);
                    return;
                }
                punishPeer(ws, 'BLOCK');
                console.log('Error replacing chain: ' + e.message);
            }
        }
    }
    else {
        console.log('received blockchain is not longer than received blockchain. Do nothing');
    }
});
const handleBinHeadersResponse = (receivedHeaders, ws) => __awaiter(this, void 0, void 0, function* () {
    if (receivedHeaders.length === 0) {
        console.log('received headers size of 0');
        return;
    }
    console.log('Received headers. Count: ' + receivedHeaders.length);
    const latestHeader = receivedHeaders[receivedHeaders.length - 1];
    const latestHeldBlock = blockchain_1.getLatestBlock();
    if (latestHeader.index > latestHeldBlock.index) {
        console.log('Peer has better chain (headers). Requesting full blocks.');
        write(ws, queryAllMsg());
    }
});
const broadcastLatest = () => {
    broadcast(responseLatestMsg());
};
exports.broadcastLatest = broadcastLatest;
const connectToPeers = (newPeer) => {
    // Avoid connecting to self? (Assumption: user manages peer list)
    if (getSockets().find((s) => s.url === newPeer)) {
        return;
    }
    knownPeers.add(newPeer);
    if (pendingPeers.has(newPeer)) {
        return;
    }
    pendingPeers.add(newPeer);
    const ws = new WebSocket(newPeer);
    ws.on('open', () => {
        pendingPeers.delete(newPeer);
        initConnection(ws);
        write(ws, queryHeadersMsg());
    });
    ws.on('error', () => {
        console.log('connection failed to ' + newPeer);
        pendingPeers.delete(newPeer);
    });
    ws.on('close', () => {
        pendingPeers.delete(newPeer);
    });
};
exports.connectToPeers = connectToPeers;
const broadCastTransactionPool = () => {
    broadcast(responseTransactionPoolMsg());
};
exports.broadCastTransactionPool = broadCastTransactionPool;
//# sourceMappingURL=p2p.js.map