"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMessagePrehash = exports.checkHash = exports.getMessage = exports.EMPTY = exports.getMask = exports.cleanBytes = exports.vecCoder = exports.splitCoder = exports.validateSigOpts = exports.validateVerOpts = exports.validateOpts = exports.copyBytes = exports.equalBytes = exports.randomBytes = exports.concatBytes = exports.abytes = exports.isBytes = void 0;
/**
 * Utilities for hex, bytearray and number handling.
 * @module
 */
/*! noble-post-quantum - MIT License (c) 2024 Paul Miller (paulmillr.com) */
const utils_1 = require("@noble/hashes/utils");
Object.defineProperty(exports, "concatBytes", { enumerable: true, get: function () { return utils_1.concatBytes; } });
/** Checks if something is Uint8Array. Be careful: nodejs Buffer will return true. */
function isBytes(a) {
    return a instanceof Uint8Array || (ArrayBuffer.isView(a) && a.constructor.name === 'Uint8Array');
}
exports.isBytes = isBytes;
/** Asserts something is Uint8Array. */
function abytes(value, length, title = '') {
    const bytes = isBytes(value);
    const len = value?.length;
    const needsLen = length !== undefined;
    if (!bytes || (needsLen && len !== length)) {
        const prefix = title && `"${title}" `;
        const ofLen = needsLen ? ` of length ${length}` : '';
        const got = bytes ? `length=${len}` : `type=${typeof value}`;
        throw new Error(prefix + 'expected Uint8Array' + ofLen + ', got ' + got);
    }
    return value;
}
exports.abytes = abytes;
const abytes_ = abytes;
exports.randomBytes = utils_1.randomBytes;
// Compares 2 u8a-s in kinda constant time
function equalBytes(a, b) {
    if (a.length !== b.length)
        return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++)
        diff |= a[i] ^ b[i];
    return diff === 0;
}
exports.equalBytes = equalBytes;
// copy bytes to new u8a (aligned). Because Buffer.slice is broken.
function copyBytes(bytes) {
    return Uint8Array.from(bytes);
}
exports.copyBytes = copyBytes;
function validateOpts(opts) {
    // We try to catch u8a, since it was previously valid argument at this position
    if (typeof opts !== 'object' || opts === null || isBytes(opts))
        throw new Error('expected opts to be an object');
}
exports.validateOpts = validateOpts;
function validateVerOpts(opts) {
    validateOpts(opts);
    if (opts.context !== undefined)
        abytes(opts.context, undefined, 'opts.context');
}
exports.validateVerOpts = validateVerOpts;
function validateSigOpts(opts) {
    validateVerOpts(opts);
    if (opts.extraEntropy !== false && opts.extraEntropy !== undefined)
        abytes(opts.extraEntropy, undefined, 'opts.extraEntropy');
}
exports.validateSigOpts = validateSigOpts;
function splitCoder(label, ...lengths) {
    const getLength = (c) => (typeof c === 'number' ? c : c.bytesLen);
    const bytesLen = lengths.reduce((sum, a) => sum + getLength(a), 0);
    return {
        bytesLen,
        encode: (bufs) => {
            const res = new Uint8Array(bytesLen);
            for (let i = 0, pos = 0; i < lengths.length; i++) {
                const c = lengths[i];
                const l = getLength(c);
                const b = typeof c === 'number' ? bufs[i] : c.encode(bufs[i]);
                abytes_(b, l, label);
                res.set(b, pos);
                if (typeof c !== 'number')
                    b.fill(0); // clean
                pos += l;
            }
            return res;
        },
        decode: (buf) => {
            abytes_(buf, bytesLen, label);
            const res = [];
            for (const c of lengths) {
                const l = getLength(c);
                const b = buf.subarray(0, l);
                res.push(typeof c === 'number' ? b : c.decode(b));
                buf = buf.subarray(l);
            }
            return res;
        },
    };
}
exports.splitCoder = splitCoder;
// nano-packed.array (fixed size)
function vecCoder(c, vecLen) {
    const bytesLen = vecLen * c.bytesLen;
    return {
        bytesLen,
        encode: (u) => {
            if (u.length !== vecLen)
                throw new Error(`vecCoder.encode: wrong length=${u.length}. Expected: ${vecLen}`);
            const res = new Uint8Array(bytesLen);
            for (let i = 0, pos = 0; i < u.length; i++) {
                const b = c.encode(u[i]);
                res.set(b, pos);
                b.fill(0); // clean
                pos += b.length;
            }
            return res;
        },
        decode: (a) => {
            abytes_(a, bytesLen);
            const r = [];
            for (let i = 0; i < a.length; i += c.bytesLen)
                r.push(c.decode(a.subarray(i, i + c.bytesLen)));
            return r;
        },
    };
}
exports.vecCoder = vecCoder;
// cleanBytes(Uint8Array.of(), [Uint16Array.of(), Uint32Array.of()])
function cleanBytes(...list) {
    for (const t of list) {
        if (Array.isArray(t))
            for (const b of t)
                b.fill(0);
        else
            t.fill(0);
    }
}
exports.cleanBytes = cleanBytes;
function getMask(bits) {
    return (1 << bits) - 1; // 4 -> 0b1111
}
exports.getMask = getMask;
exports.EMPTY = Uint8Array.of();
function getMessage(msg, ctx = exports.EMPTY) {
    abytes_(msg);
    abytes_(ctx);
    if (ctx.length > 255)
        throw new Error('context should be less than 255 bytes');
    return (0, utils_1.concatBytes)(new Uint8Array([0, ctx.length]), ctx, msg);
}
exports.getMessage = getMessage;
// 06 09 60 86 48 01 65 03 04 02
const oidNistP = /* @__PURE__ */ Uint8Array.from([6, 9, 0x60, 0x86, 0x48, 1, 0x65, 3, 4, 2]);
function checkHash(hash, requiredStrength = 0) {
    const h = hash;
    if (!h.oid || !equalBytes(h.oid.subarray(0, 10), oidNistP))
        throw new Error('hash.oid is invalid: expected NIST hash');
    const collisionResistance = (hash.outputLen * 8) / 2;
    if (requiredStrength > collisionResistance) {
        throw new Error('Pre-hash security strength too low: ' +
            collisionResistance +
            ', required: ' +
            requiredStrength);
    }
}
exports.checkHash = checkHash;
function getMessagePrehash(hash, msg, ctx = exports.EMPTY) {
    abytes_(msg);
    abytes_(ctx);
    if (ctx.length > 255)
        throw new Error('context should be less than 255 bytes');
    const hashed = hash(msg);
    return (0, utils_1.concatBytes)(new Uint8Array([1, ctx.length]), ctx, hash.oid, hashed);
}
exports.getMessagePrehash = getMessagePrehash;
//# sourceMappingURL=utils.js.map