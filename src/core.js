'use strict';


const version = "0.0.1"

const commandLineArgs = require('command-line-args')

const Config = require("./config.js");
let config = new Config();

const fs = require("fs");
const fs2 = require("./torrent-parser.js");
const DownloadTracker = require("./downloadTracker.js");
const util = require("util");

// const watcher = require("./watcher.js");

const options = commandLineArgs([
    {name: 'version', alias: 'v', type: Boolean},
    {name: 'file', alias: 'f', type: String},
    {name: 'folder', type: String},
    {name: 'files', type: Array}
])

async function main() {
    if (options.version) {
        console.log(`Cosmonaut Version ${version}`)
    } else {
        let downloadTracker = new DownloadTracker(config);

        if (options.file) {
            let torrent = await addTorrent(options.file);
            if (torrent !== null) {
                downloadTracker.queue(torrent, 0);
            }
        }
        if (options.folder) {
            let files = fs.readdirSync(options.folder);
            for (let i = 0; i < files.length; i++) {
                let torrent = await addTorrent(options.folder+"/"+files[i]);
                if (torrent !== null) {
                    downloadTracker.queue(torrent, 0);
                }
            }
        }
        if (options.files) {
            for (let i = 0; i < options.files.length; i++) {
                let torrent = await addTorrent(options.files[i]);
                if (torrent !== null) {
                    downloadTracker.queue(torrent, 0);
                }
            }
        }

        await downloadTracker.poll()
        setInterval(() => downloadTracker.poll(), 1000);
    }
}

async function addTorrent(file) {
    return new Promise(async (resolve) => {
        let torrentData = await fs2.readTorrent(file);
        if (torrentData !== null) {
            if (torrentData.announce !== undefined) {
                if (torrentData.info.mode === 0) {
                    resolve(torrentData)
                } else {
                    console.log(`[WARN] Cosmonaut cannot download multi-file torrents at this time - ${file}`)
                    resolve(null)
                }
            } else {
                console.log(`[WARN] File ${file} may be improperly formatted. Cosmonaut was unable to parse.`)
                console.log(torrentData)
                resolve(null)
            }
        } else {
            console.log(`[WARN] File ${file} may be improperly formatted or corrupt. Cosmonaut was unable to parse.`)
            resolve(null)
        }
    })
}

main();