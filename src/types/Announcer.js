const crypto = require('crypto');
const axios = require("axios");
const dgram = require('dgram');
const Buffer = require('buffer').Buffer;
const urlParse = require('url').parse;
const bencode = require("bencode");

const filesystem = require("../torrent-parser.js");
const util = require("../util.js");
const fs = require("fs");

class Announcer {
    constructor(parent) {
        this.torrent = parent;
        this.peers = [];
        this.leechers = 0;
        this.seeders = 0;
        this.announces = new Map();
    }

    async announce(isPoll) {
        await this.announceToTracker(this.torrent.announce, isPoll);
        for (let i = 0; i < this.torrent.announceList.length; i++) {
            await this.announceToTracker(this.torrent.announceList[i], isPoll);
        }
    }


    async announceToTracker(tracker, isPoll) {
        let url = urlParse(tracker);
        if (this.announces.has(tracker)) {
            console.log("Tracker already connected")
            let announcer = this.announces.get(tracker);

            if (url.protocol === "udp:") {
                console.log(`[DEBUG] Announcing presence to ${tracker}`)
                const announceReq = announcer.buildAnnounceRequest(announcer.conn.connectionId, announcer.torrent);
                await announcer.send(announceReq, url);
                this.peers = this.peers.concat(announcer.peers);
                this.seeders += announcer.seeders;
                this.leechers += announcer.leechers;
            } else if (url.protocol === "http:" || url.protocol === "https:") {
                console.log("[DEBUG] Announcing to HTTP/s Tracker: " + tracker)
                await announcer.connect(tracker, isPoll);
                this.peers = this.peers.concat(announcer.peers);
                this.seeders += announcer.seeders;
                this.leechers += announcer.leechers;
            }
        } else {
            if (url.protocol === "udp:") {
                console.log("[DEBUG] Connecting to UDP Tracker: " + tracker)
                let announcer = new UDPAnnouncer(this.torrent);
                let connectPayload = announcer.buildConnectPayload();
                console.log(`[DEBUG] Announcing presence to ${tracker}`)
                await announcer.send(connectPayload, url);
                this.peers = this.peers.concat(announcer.peers);
                this.seeders += announcer.seeders;
                this.leechers += announcer.leechers;
                this.announces.set(tracker, announcer);
            } else if (url.protocol === "http:" || url.protocol === "https:") {
                console.log("[DEBUG] Connecting to HTTP/s Tracker: " + tracker)
                let announcer = new HTTPAnnouncer(this.torrent);
                await announcer.connect(tracker);
                this.peers = this.peers.concat(announcer.peers);
                this.seeders += announcer.seeders;
                this.leechers += announcer.leechers;
                this.announces.set(tracker, announcer);
            } else {
                console.log("[DEBUG] Skipping unsupported tracker: " + tracker)
            }
        }
        let peers = this.peers;
        this.peers = peers.filter(function (elem, pos) {
            return peers.indexOf(elem) == pos;
        })
    }
}

class HTTPAnnouncer {
    constructor(parent) {
        this.peers = [];
        this.torrent = parent;
        this.leechers = 0;
        this.seeders = 0;
    }

    async connect(tracker, isPoll) {
        let payload = this.buildAnnounceRequest(isPoll)
        try {
            let {data} = await axios.get(tracker + payload, {
                responseType: 'arraybuffer'
            })
            fs.writeFileSync(tracker.split("/")[2]+".bincode", data.toString("hex"))

            let decoded = bencode.decode(data);
            if (decoded["failure reason"]) {
                console.log(tracker + payload)
                console.log("[DEBUG] Tracker rejected query because:", decoded["failure reason"].toString());
            } else {
                console.log(decoded);
            }
        } catch (e) {
            console.log("[DEBUG] Tracker connection resulted in an error.");
            console.log(e);
        }
    }

    buildAnnounceRequest(torrent, port = 6881, isPoll = false) {
        let hash = filesystem.infoHash(this.torrent).toString('hex')

        hash = hash.replace(/.{2}/g, function (m) {
            var v = parseInt(m, 16);
            if (v <= 127) {
                m = encodeURIComponent(String.fromCharCode(v));
                if (m[0] === '%')
                    m = m.toLowerCase();
            } else
                m = '%' + m;
            return m;
        });
        let s = filesystem.size(this.torrent).readUInt32BE();

        let pollSuffix = "&event=started";
        if (isPoll) pollSuffix = "";

        return `?compact=1&info_hash=${hash}&peer_id=${encodeURIComponent(util.genHTTPId())}&port=${port}&uploaded=0&downloaded=0&left=${encodeURIComponent(s)}` + pollSuffix
    }
}

class UDPAnnouncer {
    constructor(parent) {
        this.socket = dgram.createSocket('udp4');
        this.peers = [];
        this.torrent = parent;
        this.leechers = 0;
        this.seeders = 0;

        this.socket.on("message", async (response, rinfo) => {
            let parsed = this.responseType(response);
            if (parsed === 'connect') {
                this.conn = this.parseConnectionResponse(response)
                const announceReq = this.buildAnnounceRequest(this.conn.connectionId, this.torrent);
                this.socket.send(announceReq, rinfo.port, rinfo.address, () => {
                })
            } else if (parsed === 'announce') {
                const announceResp = this.parseAnnounceResponse(response);
                this.peers = this.peers.concat(announceResp.peers);
                this.leechers += announceResp.leechers;
                this.seeders += announceResp.seeders;
                this.resolveWhenPeers()
            } else {
                console.log(parsed)
            }
        });
    }

    responseType(resp) {
        const action = resp.readUInt32BE(0);
        if (action === 0) return 'connect';
        if (action === 1) return 'announce';
        if (action === 2) return 'scrape';
        if (action === 3) return 'error';
    }


    async send(message, url) {
        return new Promise((resolve) => {
            this.resolveWhenPeers = () => {
                resolve()
            };
            this.socket.send(message, url.port, url.hostname, () => {
            })
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

module.exports = {UDPAnnouncer, HTTPAnnouncer, Announcer};

