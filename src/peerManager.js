"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const INITIAL_SCORE = 100;
const BAN_THRESHOLD = 0;
const BAN_DURATION_MS = 60 * 60 * 1000; // 1 hour
class PeerManager {
    constructor() {
        this.peers = new Map();
    }
    getPeer(id) {
        if (!this.peers.has(id)) {
            this.peers.set(id, {
                id,
                score: INITIAL_SCORE,
                isBanned: false,
                banEndTime: 0
            });
        }
        return this.peers.get(id);
    }
    updateScore(id, delta) {
        const peer = this.getPeer(id);
        if (peer.isBanned && Date.now() < peer.banEndTime) {
            return; // Already banned
        }
        peer.score += delta;
        console.log(`Peer ${id} score updated by ${delta}. New score: ${peer.score}`);
        if (peer.score <= BAN_THRESHOLD) {
            this.banPeer(id);
        }
    }
    banPeer(id) {
        const peer = this.getPeer(id);
        peer.isBanned = true;
        peer.banEndTime = Date.now() + BAN_DURATION_MS;
        console.log(`Peer ${id} banned until ${new Date(peer.banEndTime).toISOString()}`);
    }
    isBanned(id) {
        const peer = this.getPeer(id);
        if (peer.isBanned) {
            if (Date.now() > peer.banEndTime) {
                peer.isBanned = false; // Unban
                peer.score = INITIAL_SCORE / 2; // Reset to lower score
                return false;
            }
            return true;
        }
        return false;
    }
    // Penalties
    punishInvalidBlock(id) {
        this.updateScore(id, -50);
    }
    punishInvalidTransaction(id) {
        this.updateScore(id, -10);
    }
    punishSpam(id) {
        this.updateScore(id, -20);
    }
}
exports.peerManager = new PeerManager();
//# sourceMappingURL=peerManager.js.map