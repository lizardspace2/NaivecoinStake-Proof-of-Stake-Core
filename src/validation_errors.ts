export enum ValidationErrorCode {
    INVALID_STRUCTURE = 'INVALID_STRUCTURE',
    INVALID_SIGNATURE = 'INVALID_SIGNATURE',
    INSUFFICIENT_FUNDS = 'INSUFFICIENT_FUNDS',
    INVALID_BLOCK_HASH = 'INVALID_BLOCK_HASH',
    INVALID_TIMESTAMP = 'INVALID_TIMESTAMP',
    INVALID_FEE = 'INVALID_FEE',
    DUPLICATE_TX = 'DUPLICATE_TX',
    INVALID_COINBASE = 'INVALID_COINBASE',
    UNKNOWN = 'UNKNOWN'
}

export class ValidationError extends Error {
    public code: ValidationErrorCode;
    public shouldBan: boolean;

    constructor(message: string, code: ValidationErrorCode, shouldBan: boolean = false) {
        super(message);
        this.code = code;
        this.shouldBan = shouldBan;
        Object.setPrototypeOf(this, new.target.prototype); // restore prototype chain
    }
}
