const Announcer = require("./Announcer");
const Peer = require("./Peer");
const fs = require("fs");
const Pieces = require('./Pieces');

class TorrentEngine {
    constructor(torrent) {
        this.torrent = torrent;
        this.announcer = new Announcer(this.torrent);
        this.connections = new Map();
    }

    async getPeers() {
        return new Promise(async (resolve) => {
            await this.announcer.announce();
            setTimeout((parent) => {
                resolve(parent.announcer.peers);
            }, 500, this)
        })
    }

    async connect() {
        let peers = await this.getPeers()
        const pieces = new Pieces(this.torrent);
        const file = fs.openSync(this.torrent.info.name, 'w');
        for (let i = 0; i < peers.length; i++) {
            let rawpeer = peers[i];
            let name = `${rawpeer.ip}:${rawpeer.port}`
            if (!this.connections.has(name)) {
                let peer = new Peer(rawpeer, this.torrent, pieces, file);
                peer.on("error", e => {
                    if (e.code !== "ECONNREFUSED" && e.code !== "ETIMEDOUT") {
                        console.log(e)
                    } else {
                        // console.log(`[DEBUG] Unable to connect to peer: ${name}`)
                    }
                    this.connections.delete(name);
                });
                peer.on("end", e => {
                    // console.log("[DEBUG] Peer connection ended.", name)
                    this.connections.delete(name);
                })
                this.connections.set(name, peer);
            }
        }
    }


    async waitForEnd() {
        return new Promise(async(resolve) => {
            let framecount = 50;
            let frames = 0;
            let frametimeMS = 500;
            while(this.connections.size > 0) {
                await sleep(frametimeMS)
                frames += 1;
                if(frames >= framecount) {
                    frames = 0;
                    await this.connect();
                }
                process.stdout.write(`\r[INFO] ${this.torrent.torrentFile} | ${this.connections.size} peer(s) | ${this.announcer.leechers} leechers | polling peers in ${((frametimeMS*(framecount-frames))/1000).toFixed(2)}s`)
            }
            resolve();
        })
    }
}


async function sleep(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    })
}

module.exports = TorrentEngine;