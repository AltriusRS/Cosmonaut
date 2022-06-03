const {Announcer} = require("./Announcer");
const Peer = require("./Peer");
const fs = require("fs");
const Pieces = require('./Pieces');

class TorrentEngine {
    constructor({torrent}) {
        this.state = "pending";
        this.started = false;
        this.torrent = torrent;
        this.announcer = new Announcer(this.torrent);
        this.connections = new Map();
        this.lastPolled = Date.now();
        this.ignore = []
    }

    async getPeers(isPoll) {
        return new Promise(async (resolve) => {
            this.state = "fetching peers";
            await this.announcer.announce(isPoll);
            this.lastPolled = Date.now();
            setTimeout((parent) => {
                this.state = "pending";
                resolve(parent.announcer.peers);
            }, 2000, this)
        })
    }

    async connect(isPoll) {
        let peers = await this.getPeers(isPoll)
        if (peers.length > 0) {
            const pieces = new Pieces(this.torrent);
            const file = fs.openSync(this.torrent.info.name, 'w');
            if(!isPoll) {
                this.state = "starting";
            } else this.state = "Checking peers"

            for (let i = 0; i < peers.length; i++) {
                let rawpeer = peers[i];
                let name = `${rawpeer.ip}:${rawpeer.port}`
                if (!this.connections.has(name) && this.ignore.includes(name)) {
                    let peer = new Peer(rawpeer, this.torrent, pieces, file);
                    peer.on("error", e => {
                        if (e.code !== "ECONNREFUSED" && e.code !== "ETIMEDOUT") {
                            console.log(e)
                        }
                        this.connections.delete(name);
                        this.ignore.push(name);
                    });
                    peer.on("end", e => {
                        console.log("[DEBUG] Peer connection ended.", name)
                        this.connections.delete(name);
                        this.ignore.push(name);
                    })
                    this.connections.set(name, peer);
                }
            }
            if(peers.length === 0) {
                this.state = "stalled";
            }
        }
    }

    async poll() {
        let bytesRead = this.bytesRead;
        if (Date.now() - this.lastPolled > 1000 * 30) {
            await this.connect();
            this.lastPolled = Date.now();
        }

        this.bytesRead = 0;

        return {
            state: this.state,
            finished: this.connections.size > 0,
            connections: this.connections.size,
            peers: this.announcer.peers.length,
            seeders: this.announcer.seeders,
            leechers: this.announcer.leechers,
            downloaded: 0,
            uploaded: "N/A",
            writingTo: this.torrent.info.name,
            downSpeed: bytesRead
        }
    }
}


async function sleep(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    })
}

module.exports = TorrentEngine;