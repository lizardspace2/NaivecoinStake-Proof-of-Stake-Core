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
const state_1 = require("./state");
const transaction_1 = require("./transaction");
const validation_errors_1 = require("./validation_errors");
class BlockExecutor {
    // Function to strictly execute a block and return the new State
    // It verifies that the block's stateRoot matches the calculated one
    static executeBlock(block, currentState) {
        return __awaiter(this, void 0, void 0, function* () {
            // 1. strictly validate block transactions against current state
            // We reuse the existing logic but wrapped in strict Executor
            // processTransactions in original code both validated AND updated.
            // We want to be explicit.
            const currentUTXOs = currentState.getUnspentTxOuts();
            // This function throws standard ValidationErrors if invalid
            // logic from original: processTransactions(newBlock.data, getUnspentTxOuts(), newBlock.index);
            // validateBlockTransactions throws if fail
            if (!transaction_1.validateBlockTransactions(block.data, currentUTXOs, block.index)) {
                throw new validation_errors_1.ValidationError('Invalid transactions in block', validation_errors_1.ValidationErrorCode.INVALID_STRUCTURE, true);
            }
            // 2. Apply transactions to get new UTXOs
            // We need a pure function that returns new UTXOs without modifying global state
            const newUnspentTxOuts = this.applyTransactions(block.data, currentUTXOs);
            // 3. Create new State
            const newState = new state_1.State(newUnspentTxOuts);
            // 4. Verify State Root (if present in block - effectively "Post-State Root")
            // In this phase we are adding stateRoot to blocks. 
            // If the block has a stateRoot property, we check it.
            if (block.stateRoot && block.stateRoot !== newState.getRoot()) {
                throw new validation_errors_1.ValidationError(`Invalid State Root. Block: ${block.stateRoot}, Calculated: ${newState.getRoot()}`, validation_errors_1.ValidationErrorCode.INVALID_BLOCK_HASH, true);
            }
            return newState;
        });
    }
    static applyTransactions(transactions, unspentTxOuts) {
        // Logic extracted from transaction.ts processTransactions -> updateUnspentTxOuts
        const newUnspentTxOuts = transactions
            .map((t) => {
            return t.txOuts.map((txOut, index) => new transaction_1.UnspentTxOut(t.id, index, txOut.address, txOut.amount));
        })
            .reduce((a, b) => a.concat(b), []);
        const consumedTxOuts = transactions
            .map((t) => t.txIns)
            .reduce((a, b) => a.concat(b), [])
            .map((txIn) => new transaction_1.UnspentTxOut(txIn.txOutId, txIn.txOutIndex, '', 0));
        const resultingUnspentTxOuts = unspentTxOuts
            .filter(((uTxO) => !this.findUnspentTxOut(uTxO.txOutId, uTxO.txOutIndex, consumedTxOuts)))
            .concat(newUnspentTxOuts);
        return resultingUnspentTxOuts;
    }
    static findUnspentTxOut(transactionId, index, aUnspentTxOuts) {
        return aUnspentTxOuts.find((uTxO) => uTxO.txOutId === transactionId && uTxO.txOutIndex === index) !== undefined;
    }
}
exports.BlockExecutor = BlockExecutor;
//# sourceMappingURL=execution.js.map