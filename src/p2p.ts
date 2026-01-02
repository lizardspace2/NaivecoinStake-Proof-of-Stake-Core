import * as WebSocket from 'ws';
import { Server } from 'ws';
import {
    addBlockToChain, Block, getBlockchain, getLatestBlock, handleReceivedTransaction, isValidBlockStructure,
    replaceChain, getBlockHeaders, isValidBlockHeader
} from './blockchain';
import { Transaction } from './transaction';
import { getTransactionPool } from './transactionPool';
import { ValidationError } from './validation_errors';

import { peerManager } from './peerManager';

const sockets: WebSocket[] = [];


enum MessageType {
    QUERY_LATEST = 0,
    QUERY_ALL = 1,
    RESPONSE_BLOCKCHAIN = 2,
    QUERY_TRANSACTION_POOL = 3,
    RESPONSE_TRANSACTION_POOL = 4,
    QUERY_HEADERS = 5,
    RESPONSE_HEADERS = 6,
    QUERY_BLOCK_DATA = 7,
    RESPONSE_BLOCK_DATA = 8
}

class Message {
    public type: MessageType;
    public data: any;
}

const initP2PServer = (p2pPort: number) => {
    const server: Server = new WebSocket.Server({ port: p2pPort });
    server.on('connection', (ws: WebSocket, req: any) => {
        const ip = req.socket.remoteAddress;
        if (peerManager.isBanned(ip)) {
            console.log('Rejected connection from banned peer: ' + ip);
            ws.close();
            return;
        }
        initConnection(ws);
    });
    console.log('listening websocket p2p port on: ' + p2pPort);
};

const getSockets = () => sockets;

const initConnection = (ws: WebSocket) => {
    sockets.push(ws);
    initMessageHandler(ws);
    initErrorHandler(ws);
    write(ws, queryChainLengthMsg());

    setTimeout(() => {
        broadcast(queryTransactionPoolMsg());
    }, 500);
};

const JSONToObject = <T>(data: string): T => {
    try {
        return JSON.parse(data);
    } catch (e) {
        console.log(e);
        return null;
    }
};

const initMessageHandler = (ws: WebSocket) => {
    ws.on('message', (data: string) => {
        try {
            const message: Message = JSONToObject<Message>(data);
            if (message === null) {
                console.log('could not parse received JSON message: ' + data);
                return;
            }
            console.log('Received message: %s', JSON.stringify(message));
            if (message.type === MessageType.QUERY_LATEST) {
                write(ws, responseLatestMsg());
            } else if (message.type === MessageType.QUERY_ALL) {
                write(ws, responseChainMsg());
            } else if (message.type === MessageType.RESPONSE_BLOCKCHAIN) {
                const receivedBlocks: Block[] = JSONToObject<Block[]>(message.data);
                if (receivedBlocks === null) {
                    console.log('invalid blocks received: %s', JSON.stringify(message.data));
                    return;
                }
                console.log('Received blockchain response. Count: ' + receivedBlocks.length);
                if (receivedBlocks.length > 0) {
                    console.log('Range: ' + receivedBlocks[0].index + ' -> ' + receivedBlocks[receivedBlocks.length - 1].index);
                }
                handleBlockchainResponse(receivedBlocks, ws);
            } else if (message.type === MessageType.QUERY_TRANSACTION_POOL) {
                write(ws, responseTransactionPoolMsg());
            } else if (message.type === MessageType.RESPONSE_TRANSACTION_POOL) {
                const receivedTransactions: Transaction[] = JSONToObject<Transaction[]>(message.data);
                if (receivedTransactions === null) {
                    console.log('invalid transaction received: %s', JSON.stringify(message.data));
                    return;
                }
                receivedTransactions.forEach((transaction: Transaction) => {
                    try {
                        handleReceivedTransaction(transaction);
                        broadcast(responseTransactionPoolMsg());
                    } catch (e) {
                        console.log(e.message);
                    }
                });
            } else if (message.type === MessageType.QUERY_HEADERS) {
                write(ws, responseHeadersMsg());
            } else if (message.type === MessageType.RESPONSE_HEADERS) {
                const receivedHeaders: Block[] = JSONToObject<Block[]>(message.data);
                if (receivedHeaders === null) {
                    console.log('invalid headers received: %s', JSON.stringify(message.data));
                    return;
                }
                handleBinHeadersResponse(receivedHeaders, ws);
            }
        } catch (e) {
            console.log(e);
        }
    });
};

const write = (ws: WebSocket, message: Message): void => ws.send(JSON.stringify(message));
const broadcast = (message: Message): void => sockets.forEach((socket) => write(socket, message));

const queryChainLengthMsg = (): Message => ({ 'type': MessageType.QUERY_LATEST, 'data': null });

const queryAllMsg = (): Message => ({
    'type': MessageType.QUERY_ALL,
    'data': null
});

const responseChainMsg = (): Message => ({
    'type': MessageType.RESPONSE_BLOCKCHAIN, 'data': JSON.stringify(getBlockchain())
});

const responseLatestMsg = (): Message => ({
    'type': MessageType.RESPONSE_BLOCKCHAIN,
    'data': JSON.stringify([getLatestBlock()])
});

const queryTransactionPoolMsg = (): Message => ({
    'type': MessageType.QUERY_TRANSACTION_POOL,
    'data': null
});

const responseTransactionPoolMsg = (): Message => ({
    'type': MessageType.RESPONSE_TRANSACTION_POOL,
    'data': JSON.stringify(getTransactionPool())
});

const queryHeadersMsg = (): Message => ({
    'type': MessageType.QUERY_HEADERS,
    'data': null
});

const responseHeadersMsg = (): Message => ({
    'type': MessageType.RESPONSE_HEADERS,
    'data': JSON.stringify(getBlockHeaders(0, getBlockchain().length))
});

const initErrorHandler = (ws: WebSocket) => {
    const closeConnection = (myWs: WebSocket) => {
        console.log('connection failed to peer: ' + myWs.url);
        sockets.splice(sockets.indexOf(myWs), 1);
    };
    ws.on('close', () => closeConnection(ws));
    ws.on('error', () => closeConnection(ws));
};

const banPeer = (ws: WebSocket, reason: string) => {
    const ip = (ws as any)._socket.remoteAddress;
    console.log(`Banning peer ${ip} for: ${reason}`);
    peerManager.banPeer(ip);
    ws.close();
};

const punishPeer = (ws: WebSocket, penaltyType: 'BLOCK' | 'TX' | 'SPAM') => {
    const ip = (ws as any)._socket.remoteAddress;
    if (penaltyType === 'BLOCK') peerManager.punishInvalidBlock(ip);
    else if (penaltyType === 'TX') peerManager.punishInvalidTransaction(ip);
    else if (penaltyType === 'SPAM') peerManager.punishSpam(ip);

    if (peerManager.isBanned(ip)) {
        ws.close();
    }
};

const handleBlockchainResponse = async (receivedBlocks: Block[], ws: WebSocket) => {
    if (receivedBlocks.length === 0) {
        console.log('received block chain size of 0');
        return;
    }
    const latestBlockReceived: Block = receivedBlocks[receivedBlocks.length - 1];
    if (!isValidBlockStructure(latestBlockReceived)) {
        console.log('block structuture not valid');
        return;
    }
    const latestBlockHeld: Block = getLatestBlock();
    if (latestBlockReceived.index > latestBlockHeld.index) {
        console.log('blockchain possibly behind. We got: '
            + latestBlockHeld.index + ' Peer got: ' + latestBlockReceived.index);
        if (latestBlockHeld.hash === latestBlockReceived.previousHash) {
            try {
                if (await addBlockToChain(latestBlockReceived)) {
                    broadcast(responseLatestMsg());
                }
            } catch (e) {
                if (e instanceof ValidationError && e.shouldBan) {
                    banPeer(ws, e.message);
                    return;
                }
                punishPeer(ws, 'BLOCK');
                console.log('Error adding block: ' + e.message);
            }
        } else if (receivedBlocks.length === 1) {
            console.log('We have to query the chain from our peer');
            broadcast(queryHeadersMsg());
        } else {
            console.log('Received blockchain is longer than current blockchain');
            try {
                await replaceChain(receivedBlocks);
            } catch (e) {
                if (e instanceof ValidationError && e.shouldBan) {
                    banPeer(ws, e.message);
                    return;
                }
                punishPeer(ws, 'BLOCK');
                console.log('Error replacing chain: ' + e.message);
            }
        }
    } else {
        console.log('received blockchain is not longer than received blockchain. Do nothing');
    }
};

const handleBinHeadersResponse = async (receivedHeaders: Block[], ws: WebSocket) => {

    if (receivedHeaders.length === 0) {
        console.log('received headers size of 0');
        return;
    }
    console.log('Received headers. Count: ' + receivedHeaders.length);
    const latestHeader = receivedHeaders[receivedHeaders.length - 1];
    const latestHeldBlock = getLatestBlock();

    if (latestHeader.index > latestHeldBlock.index) {
        console.log('Peer has better chain (headers). Requesting full blocks.');
        write(ws, queryAllMsg());
    }
};

const broadcastLatest = (): void => {
    broadcast(responseLatestMsg());
};

const connectToPeers = (newPeer: string): void => {
    const ip = newPeer.split(':')[0].replace('ws://', '');

    const ws: WebSocket = new WebSocket(newPeer);
    ws.on('open', () => {
        initConnection(ws);
        write(ws, queryHeadersMsg());
    });
    ws.on('error', () => {
        console.log('connection failed');
    });
};

const broadCastTransactionPool = () => {
    broadcast(responseTransactionPoolMsg());
};

export { connectToPeers, broadcastLatest, broadCastTransactionPool, initP2PServer, getSockets };
