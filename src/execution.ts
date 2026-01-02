import { Block } from './blockchain';
import { State } from './state';
import { Transaction, UnspentTxOut, processTransactions, getCoinbaseTransaction, validateTransaction, getTxFee, validateBlockTransactions } from './transaction';
import { ValidationError, ValidationErrorCode } from './validation_errors';
import * as _ from 'lodash';

export class BlockExecutor {

    public static async executeBlock(block: Block, currentState: State): Promise<State> {

        const currentUTXOs = currentState.getUnspentTxOuts();

        if (!validateBlockTransactions(block.data, currentUTXOs, block.index)) {
            throw new ValidationError('Invalid transactions in block', ValidationErrorCode.INVALID_STRUCTURE, true);
        }

        const newUnspentTxOuts = this.applyTransactions(block.data, currentUTXOs);

        const newState = new State(newUnspentTxOuts);

        if ((block as any).stateRoot && (block as any).stateRoot !== newState.getRoot()) {
            throw new ValidationError(
                `Invalid State Root. Block: ${(block as any).stateRoot}, Calculated: ${newState.getRoot()}`,
                ValidationErrorCode.INVALID_BLOCK_HASH,
                true
            );
        }

        return newState;
    }

    private static applyTransactions(transactions: Transaction[], unspentTxOuts: UnspentTxOut[]): UnspentTxOut[] {
        const newUnspentTxOuts: UnspentTxOut[] = transactions
            .map((t) => {
                return t.txOuts.map((txOut, index) => new UnspentTxOut(t.id, index, txOut.address, txOut.amount));
            })
            .reduce((a, b) => a.concat(b), []);

        const consumedTxOuts: UnspentTxOut[] = transactions
            .map((t) => t.txIns)
            .reduce((a, b) => a.concat(b), [])
            .map((txIn) => new UnspentTxOut(txIn.txOutId, txIn.txOutIndex, '', 0));

        const resultingUnspentTxOuts = unspentTxOuts
            .filter(((uTxO) => !this.findUnspentTxOut(uTxO.txOutId, uTxO.txOutIndex, consumedTxOuts)))
            .concat(newUnspentTxOuts);

        return resultingUnspentTxOuts;
    }

    private static findUnspentTxOut(transactionId: string, index: number, aUnspentTxOuts: UnspentTxOut[]): boolean {
        return aUnspentTxOuts.find((uTxO) => uTxO.txOutId === transactionId && uTxO.txOutIndex === index) !== undefined;
    }
}
