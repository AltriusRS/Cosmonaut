'use strict';

const crypto = require('crypto');

const BinVersion = "001";

let id = null;
let httpID = null

module.exports.genId = () => {
    if (!id) {
        id = crypto.randomBytes(20);
        Buffer.from('COS' + BinVersion).copy(id, 0);
    }
    return id;
};

module.exports.genHTTPId = () => {
    if (!httpID) {
        httpID = "COS" + BinVersion.padEnd(10, "-") + crypto.randomBytes(10).toString('hex');
        httpID = httpID.slice(0, 20);
        console.log(httpID.length);
    }
    return httpID
}