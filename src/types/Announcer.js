const crypto = require('crypto');
const dgram = require('dgram');
const Buffer = require('buffer').Buffer;
const urlParse = require('url').parse;


const filesystem = require("../filesystem.js");
const util = require("../util.js");

class Announcer {
    constructor(parent) {
        this.socket = dgram.createSocket('udp4');
        this.peers = [];
        this.torrent = parent;
        this.leechers = 0;
        this.seeders = 0;

        this.socket.on("message", async (response, rinfo) => {
            let parsed = this.responseType(response);
            // console.log(`[DEBUG] ${parsed} received from tracker ${rinfo.address}:${rinfo.port}`)
            if (parsed === 'connect') {
                let conn = this.parseConnectionResponse(response)
                const announceReq = this.buildAnnounceRequest(conn.connectionId, this.torrent);
                this.send(announceReq, {port: rinfo.port, hostname: rinfo.address});
            } else if (parsed === 'announce') {
                const announceResp = this.parseAnnounceResponse(response);
                this.peers = this.peers.concat(announceResp.peers);
                this.leechers += announceResp.leechers;
                this.seeders += announceResp.seeders;
            }
        });
    }

    responseType(resp) {
        const action = resp.readUInt32BE(0);
        if (action === 0) return 'connect';
        if (action === 1) return 'announce';
    }


    async announce() {
        await this.announceToTracker(this.torrent.announce);
        for (let i = 0; i < this.torrent.announceList.length; i++) {
            await this.announceToTracker(this.torrent.announceList[i]);
        }
    }


    async announceToTracker(tracker) {
        let url = urlParse(tracker);
        if (url.protocol === "udp:") {
            let connectPayload = this.buildConnectPayload();
            // console.log(`[DEBUG] Announcing presence to ${tracker}`)
            let x = await this.send(connectPayload, url);
        } else {
            // console.log("[DEBUG] Skipping unsupported tracker: " + tracker)
        }

        return []
    }

    async send(message, url) {
        return new Promise((resolve) => {
            this.socket.send(message, url.port, url.hostname, resolve)
        })
    }

    buildConnectPayload() {
        const buf = Buffer.alloc(16);

        // connection id
        buf.writeUInt32BE(0x417, 0);
        buf.writeUInt32BE(0x27101980, 4);

        // action
        buf.writeUInt32BE(0, 8);

        // transaction id
        crypto.randomBytes(4).copy(buf, 12);

        return buf;

    }

    parseConnectionResponse(resp) {
        return {
            action: resp.readUInt32BE(0),
            transactionId: resp.readUInt32BE(4),
            connectionId: resp.slice(8)
        }
    }

    buildAnnounceRequest(connId, torrent, port = 6881) {
        const buf = Buffer.allocUnsafe(98);

        // connection id
        connId.copy(buf, 0);
        // action
        buf.writeUInt32BE(1, 8);
        // transaction id
        crypto.randomBytes(4).copy(buf, 12);
        // info hash
        filesystem.infoHash(torrent).copy(buf, 16);
        // peerId
        util.genId().copy(buf, 36);
        // downloaded
        Buffer.alloc(8).copy(buf, 56);
        // left
        filesystem.size(torrent).copy(buf, 64);
        // uploaded
        Buffer.alloc(8).copy(buf, 72);
        // event
        buf.writeUInt32BE(0, 80);
        // ip address
        buf.writeUInt32BE(0, 84);
        // key
        crypto.randomBytes(4).copy(buf, 88);
        // num want
        buf.writeInt32BE(-1, 92);
        // port
        buf.writeUInt16BE(port, 96);

        return buf;
    }


    parseAnnounceResponse(resp) {
        function group(iterable, groupSize) {
            let groups = [];
            for (let i = 0; i < iterable.length; i += groupSize) {
                groups.push(iterable.slice(i, i + groupSize));
            }
            return groups;
        }

        return {
            action: resp.readUInt32BE(0),
            transactionId: resp.readUInt32BE(4),
            leechers: resp.readUInt32BE(8),
            seeders: resp.readUInt32BE(12),
            peers: group(resp.slice(20), 6).map(address => {
                return {
                    ip: address.slice(0, 4).join('.'),
                    port: address.readUInt16BE(4)
                }
            })
        }
    }
}

module.exports = Announcer;