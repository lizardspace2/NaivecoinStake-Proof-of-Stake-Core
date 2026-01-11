
const { shake256 } = require('@noble/hashes/sha3');
console.log('shake256.create:', typeof shake256.create);
try {
    const hash = shake256.create({ dkLen: 32 });
    console.log('create({ dkLen: 32 }) worked');
} catch (e) {
    console.log('create({ dkLen: 32 }) failed:', e.message);
}

try {
    const hash = shake256.create();
    console.log('create() worked');
    console.log('hash methods:', Object.keys(hash), Object.getPrototypeOf(hash));
} catch (e) {
    console.log('create() failed:', e.message);
}
