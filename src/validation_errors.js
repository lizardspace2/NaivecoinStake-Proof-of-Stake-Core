"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var ValidationErrorCode;
(function (ValidationErrorCode) {
    ValidationErrorCode["INVALID_STRUCTURE"] = "INVALID_STRUCTURE";
    ValidationErrorCode["INVALID_SIGNATURE"] = "INVALID_SIGNATURE";
    ValidationErrorCode["INSUFFICIENT_FUNDS"] = "INSUFFICIENT_FUNDS";
    ValidationErrorCode["INVALID_BLOCK_HASH"] = "INVALID_BLOCK_HASH";
    ValidationErrorCode["INVALID_TIMESTAMP"] = "INVALID_TIMESTAMP";
    ValidationErrorCode["INVALID_FEE"] = "INVALID_FEE";
    ValidationErrorCode["DUPLICATE_TX"] = "DUPLICATE_TX";
    ValidationErrorCode["INVALID_COINBASE"] = "INVALID_COINBASE";
    ValidationErrorCode["UNKNOWN"] = "UNKNOWN";
})(ValidationErrorCode = exports.ValidationErrorCode || (exports.ValidationErrorCode = {}));
class ValidationError extends Error {
    constructor(message, code, shouldBan = false) {
        super(message);
        this.code = code;
        this.shouldBan = shouldBan;
        Object.setPrototypeOf(this, new.target.prototype);
    }
}
exports.ValidationError = ValidationError;
//# sourceMappingURL=validation_errors.js.map