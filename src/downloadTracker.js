const TorrentEngine = require("./types/TorrentEngine");
const EventEmitter = require("events");
const util = require("util")

class DownloadTracker extends EventEmitter {

    constructor(config) {
        super();

        this.config = config;
        this.q = [];
        this.downloading = [];
        this.uploading = [];
    }

    sort() {
        this.q = this.q.sort((a, b) => {
            if (a.priority === b.priority) {
                return 0
            } else if (a.priority > b.priority) {
                return -1;
            } else return 1;
        });
    }

    async spawnDownload(i) {
        this.downloading.splice(i, 1)
        this.sort();
        this.downloading.push(await download(this.q[0]));
        this.q.shift();
    }

    async poll() {
        // console.clear();
        console.log(`Items Pending: ${this.q.length}\nItems Downloading: ${this.downloading.length}`)
        let entries = []
        if (this.q.length === 0) {
            if (this.uploading.length === 0 && this.downloading.length === 0) {
                console.log("Cosmonaut has successfully cleared all pending downloads, and seeds.\nIt will be exiting shortly.")
                process.exit();
            } else {
                if (this.downloading.length > 0) {
                    for (let i = 0; i < this.downloading.length; i++) {
                        let download = this.downloading[i];
                        let stats = await download.poll();
                        entries.push(stats);
                        if (this.q.length > 0 && stats.finished) {
                            await this.spawnDownload(i)
                        }
                    }
                } else {
                    this.sort();
                    while (this.downloading.length < this.config.concurrency.downloadLimit && this.q.length > 0) {
                        this.downloading.push(await download(this.q[0]));
                        this.q.shift();
                    }
                }
            }
        } else {
            if (this.downloading.length > 0) {
                for (let i = 0; i < this.downloading.length; i++) {
                    let download = this.downloading[i];
                    let stats = await download.poll();
                    entries.push(stats);
                    if (this.q.length > 0 && stats.finished) {
                        await this.spawnDownload(i)
                    }
                }
            } else {
                this.sort();
                while (this.downloading.length < this.config.concurrency.downloadLimit && this.q.length > 0) {
                    this.downloading.push(await download(this.q[0]));
                    this.q.shift();
                }
            }
        }

        console.table(entries)
    }

    queue(torrent, priority = 0) {
        this.q.push({torrent, priority});
        this.sort();
    }
}


module.exports = DownloadTracker;


async function download(torrent) {
    let engine = new TorrentEngine(torrent);
    // console.log(engine);
    await engine.connect();
    // console.log(engine.state);
    return engine
}
