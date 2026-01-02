import * as _ from 'lodash';
import { UnspentTxOut, Transaction, TxIn, TxOut } from './transaction';
import * as CryptoJS from 'crypto-js';

const calculateStateRoot = (unspentTxOuts: UnspentTxOut[]): string => {
    const sortedUTXOs = _.sortBy(unspentTxOuts, ['txOutId', 'txOutIndex']);
    const utxoStrings = sortedUTXOs.map(u => u.txOutId + u.txOutIndex + u.address + u.amount);

    if (utxoStrings.length === 0) {
        return CryptoJS.SHA256("").toString();
    }

    return CryptoJS.SHA256(utxoStrings.join('')).toString();
};

export class State {
    private unspentTxOuts: UnspentTxOut[];

    constructor(initialUnspentTxOuts: UnspentTxOut[] = []) {
        this.unspentTxOuts = _.cloneDeep(initialUnspentTxOuts);
    }

    public getUnspentTxOuts(): UnspentTxOut[] {
        return _.cloneDeep(this.unspentTxOuts);
    }

    public setUnspentTxOuts(newUnspentTxOuts: UnspentTxOut[]) {
        this.unspentTxOuts = newUnspentTxOuts;
    }

    public getRoot(): string {
        return calculateStateRoot(this.unspentTxOuts);
    }

    public isValidTxIn(txIn: TxIn): boolean {
        const referencedUTxOut = this.unspentTxOuts.find((uTxO) => uTxO.txOutId === txIn.txOutId && uTxO.txOutIndex === txIn.txOutIndex);
        return referencedUTxOut !== undefined;
    }

    public getTxInAmount(txIn: TxIn): number {
        const referencedUTxOut = this.unspentTxOuts.find((uTxO) => uTxO.txOutId === txIn.txOutId && uTxO.txOutIndex === txIn.txOutIndex);
        return referencedUTxOut ? referencedUTxOut.amount : 0;
    }
}
