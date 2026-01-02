
export interface PeerState {
    id: string; // IP or IP:Port
    score: number;
    isBanned: boolean;
    banEndTime: number;
}

const INITIAL_SCORE = 100;
const BAN_THRESHOLD = 0;
const BAN_DURATION_MS = 60 * 60 * 1000; // 1 hour

class PeerManager {
    private peers: Map<string, PeerState> = new Map();

    public getPeer(id: string): PeerState {
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

    public updateScore(id: string, delta: number): void {
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

    public banPeer(id: string): void {
        const peer = this.getPeer(id);
        peer.isBanned = true;
        peer.banEndTime = Date.now() + BAN_DURATION_MS;
        console.log(`Peer ${id} banned until ${new Date(peer.banEndTime).toISOString()}`);
    }

    public isBanned(id: string): boolean {
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
    public punishInvalidBlock(id: string) {
        this.updateScore(id, -50);
    }

    public punishInvalidTransaction(id: string) {
        this.updateScore(id, -10);
    }

    public punishSpam(id: string) {
        this.updateScore(id, -20);
    }
}

export const peerManager = new PeerManager();
