import { Block } from './blockchain';
import { State } from './state';
import { Transaction, UnspentTxOut, processTransactions, getCoinbaseTransaction, validateTransaction, getTxFee, validateBlockTransactions } from './transaction';
import { ValidationError, ValidationErrorCode } from './validation_errors';
import * as _ from 'lodash';

export class BlockExecutor {

    // Function to strictly execute a block and return the new State
    // It verifies that the block's stateRoot matches the calculated one
    public static async executeBlock(block: Block, currentState: State): Promise<State> {
        // 1. strictly validate block transactions against current state
        // We reuse the existing logic but wrapped in strict Executor
        // processTransactions in original code both validated AND updated.
        // We want to be explicit.

        const currentUTXOs = currentState.getUnspentTxOuts();

        // This function throws standard ValidationErrors if invalid
        // logic from original: processTransactions(newBlock.data, getUnspentTxOuts(), newBlock.index);

        // validateBlockTransactions throws if fail
        if (!validateBlockTransactions(block.data, currentUTXOs, block.index)) {
            throw new ValidationError('Invalid transactions in block', ValidationErrorCode.INVALID_STRUCTURE, true);
        }

        // 2. Apply transactions to get new UTXOs
        // We need a pure function that returns new UTXOs without modifying global state
        const newUnspentTxOuts = this.applyTransactions(block.data, currentUTXOs);

        // 3. Create new State
        const newState = new State(newUnspentTxOuts);

        // 4. Verify State Root (if present in block - effectively "Post-State Root")
        // In this phase we are adding stateRoot to blocks. 
        // If the block has a stateRoot property, we check it.
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
        // Logic extracted from transaction.ts processTransactions -> updateUnspentTxOuts
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
