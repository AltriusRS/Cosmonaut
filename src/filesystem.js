const fs = require("fs");
const crypto = require('crypto');

const MetaInfo = require("./types/MetaInfo.js");

const bencode = require("bencode");


module.exports.BLOCK_LEN = Math.pow(2, 14);

module.exports = {
    readTorrent: async (path) => {
        if (fs.existsSync(path)) {
            return new MetaInfo(fs.readFileSync(path), path);
        } else return null;
    },
    size: torrent => {
        let size;

        if (torrent.info.type === 1) {
            size = torrent.info.files.map(file => file.length).reduce((a, b) => a + b)
        } else size = torrent.info.length;

        return new Buffer.alloc(8,size);
    },
    infoHash: torrent => {
        const info = bencode.encode(torrent.rawInfo);
        return crypto.createHash('sha1').update(info).digest();
    }
}

module.exports.pieceLen = (torrent, pieceIndex) => {
    const totalLength = Number(module.exports.size(torrent));
    const pieceLength = torrent.info.pieceLength;

    const lastPieceLength = totalLength % pieceLength;
    const lastPieceIndex = Math.floor(totalLength / pieceLength);

    return lastPieceIndex === pieceIndex ? lastPieceLength : pieceLength;
};

module.exports.blocksPerPiece = (torrent, pieceIndex) => {
    const pieceLength = module.exports.pieceLen(torrent, pieceIndex);
    return Math.ceil(pieceLength / module.exports.BLOCK_LEN);
};

module.exports.blockLen = (torrent, pieceIndex, blockIndex) => {
    const pieceLength = module.exports.pieceLen(torrent, pieceIndex);

    const lastPieceLength = pieceLength % module.exports.BLOCK_LEN;
    const lastPieceIndex = Math.floor(pieceLength / module.exports.BLOCK_LEN);

    return blockIndex === lastPieceIndex ? lastPieceLength : module.exports.BLOCK_LEN;
};