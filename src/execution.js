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
    static executeBlock(block, currentState) {
        return __awaiter(this, void 0, void 0, function* () {
            const currentUTXOs = currentState.getUnspentTxOuts();
            if (!transaction_1.validateBlockTransactions(block.data, currentUTXOs, block.index)) {
                throw new validation_errors_1.ValidationError('Invalid transactions in block', validation_errors_1.ValidationErrorCode.INVALID_STRUCTURE, true);
            }
            const newUnspentTxOuts = this.applyTransactions(block.data, currentUTXOs);
            const newState = new state_1.State(newUnspentTxOuts);
            if (block.stateRoot && block.stateRoot !== newState.getRoot()) {
                throw new validation_errors_1.ValidationError(`Invalid State Root. Block: ${block.stateRoot}, Calculated: ${newState.getRoot()}`, validation_errors_1.ValidationErrorCode.INVALID_BLOCK_HASH, true);
            }
            return newState;
        });
    }
    static applyTransactions(transactions, unspentTxOuts) {
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