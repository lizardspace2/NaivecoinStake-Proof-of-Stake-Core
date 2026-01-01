"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const CryptoJS = require("crypto-js");
const getMerkleRoot = (transactions) => {
    const count = transactions.length;
    if (count === 0) {
        return '';
    }
    const previousTreeLayer = transactions.map((t) => t.id);
    const treeLayer = previousTreeLayer;
    return getMerkleRootRecursive(treeLayer);
};
exports.getMerkleRoot = getMerkleRoot;
const getMerkleRootRecursive = (layer) => {
    if (layer.length === 1) {
        return layer[0];
    }
    const newLayer = [];
    for (let i = 0; i < layer.length; i += 2) {
        const left = layer[i];
        const right = (i + 1 < layer.length) ? layer[i + 1] : left;
        // Hash the pair
        const hash = CryptoJS.SHA256(left + right).toString();
        newLayer.push(hash);
    }
    return getMerkleRootRecursive(newLayer);
};
//# sourceMappingURL=merkle.js.map