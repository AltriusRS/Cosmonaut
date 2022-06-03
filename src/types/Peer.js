const net = require('net');
const EventEmitter = require("events");
const message = require("../message");
const Queue = require('./Queue');


class Peer extends EventEmitter {
    constructor({ip, port}, torrent, pieces, file) {
        super();
        // console.log(`[DEBUG] Attempting to connect to peer: ${ip}:${port}`)
        this.requested = [];
        this.socket = new net.Socket();
        this.socket.on("error", (e) => this.emit("error", e));
        this.socket.on("end", ()=> this.emit("end"))
        this.handle = file;
        this.pieces = pieces;
        this.queue = new Queue(torrent);


        let savedBuf = Buffer.alloc(0);
        let handshake = true;

        this.socket.on('data', recvBuf => {
            // msgLen calculates the length of a whole message
            const msgLen = () => handshake ? savedBuf.readUInt8(0) + 49 : savedBuf.readInt32BE(0) + 4;
            savedBuf = Buffer.concat([savedBuf, recvBuf]);

            while (savedBuf.length >= 4 && savedBuf.length >= msgLen()) {
                this.emit("message", savedBuf.slice(0, msgLen()));
                savedBuf = savedBuf.slice(msgLen());
                handshake = false;
            }
        });

        this.socket.connect(port, ip, async () => {
            this.emit("connected");
            // console.log(`[DEBUG] Connected to peer: ${ip}:${port}`)
            let e = await this.write(message.buildHandshake(torrent));
            if (!e) {
                // console.log(`[DEBUG] Sent handshake to peer: ${ip}:${port}`)
            } else {
                console.log(`[ERROR] Unable to send handshake to peer: ${ip}:${port}`)
                console.log(e);
            }
        })

        this.on("message", (data) => {
            // console.log(`[DEBUG] message from peer: ${ip}:${port}`)
            if (isHandshake(data)) {
                this.socket.write(message.buildInterested())
            } else {
                const m = message.parse(data);
                console.log(m)
                if (m.id === 0) chokeHandler(this.socket);
                if (m.id === 1) unchokeHandler(this.socket, this.pieces, this.queue);
                if (m.id === 4) haveHandler(this.socket, this.pieces, this.queue, m.payload);
                if (m.id === 5) bitfieldHandler(this.socket, this.pieces, this.queue, m.payload);
                if (m.id === 7) pieceHandler(this.socket, this.pieces, this.queue, torrent, this.file, m.payload);
            }
        })
    }


    async write(data) {
        return new Promise(resolve => {
            this.socket.write(data, (e) => {
                resolve(e);
            })
        })
    }
}

module.exports = Peer;


function isHandshake(msg) {
    return msg.length === msg.readUInt8(0) + 49 &&
        msg.toString('utf8', 1) === 'BitTorrent protocol';
}

function chokeHandler(socket) {
    socket.end();
}

function unchokeHandler(socket, pieces, queue) {
    queue.choked = false;
    requestPiece(socket, pieces, queue);
}

function haveHandler(socket, pieces, queue, payload) {
    const pieceIndex = payload.readUInt32BE(0);
    const queueEmpty = queue.length === 0;
    queue.queue(pieceIndex);
    if (queueEmpty) requestPiece(socket, pieces, queue);
}

function bitfieldHandler(socket, pieces, queue, payload) {
    const queueEmpty = queue.length === 0;
    payload.forEach((byte, i) => {
        for (let j = 0; j < 8; j++) {
            if (byte % 2) queue.queue(i * 8 + 7 - j);
            byte = Math.floor(byte / 2);
        }
    });
    if (queueEmpty) requestPiece(socket, pieces, queue);
}

function pieceHandler(socket, pieces, queue, torrent, file, pieceResp) {
    pieces.printPercentDone();

    pieces.addReceived(pieceResp);

    const offset = pieceResp.index * torrent.info['piece length'] + pieceResp.begin;
    fs.write(file, pieceResp.block, 0, pieceResp.block.length, offset, () => {});

    if (pieces.isDone()) {
        console.log('DONE!');
        socket.end();
        try {
            fs.closeSync(file);
        } catch (e) {
        }
    } else {
        requestPiece(socket, pieces, queue);
    }
}

function requestPiece(socket, pieces, queue) {
    if (queue.choked) return null;

    while (queue.length()) {
        const pieceBlock = queue.deque();
        if (pieces.needed(pieceBlock)) {
            socket.write(message.buildRequest(pieceBlock));
            pieces.addRequested(pieceBlock);
            break;
        }
    }
}