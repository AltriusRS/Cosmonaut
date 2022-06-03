'use strict';

const fs = require("./filesystem.js");
const TorrentEngine = require("./types/TorrentEngine");


main();

async function main() {
    for (let i = 0; i < testFiles.length; i++) {
        let torrentData = await fs.readTorrent(testFiles[i]);
        if (torrentData !== null) {
            if (torrentData.announce !== undefined) {
                if (torrentData.info.mode === 0) {
                    let engine = new TorrentEngine(torrentData);
                    await engine.connect();
                    await engine.waitForEnd();
                } else {
                    console.log(`[WARN] Osiris cannot download multi-file torrents at this time - ${testFiles[i]}`)
                }
            } else {
                console.log(`[WARN] File ${testFiles[i]} may be improperly formatted. Osiris was unable to parse.`)
                console.log(torrentData)
            }
        } else {
            console.log(`[WARN] File ${testFiles[i]} may be improperly formatted or corrupt. Osiris was unable to parse.`)
        }
    }
}