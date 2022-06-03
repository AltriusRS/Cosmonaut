// Defines the default configuration settings for Cosmonaut
// used when the config file is corrupt or inaccessible (or being initialized for the first time)
module.exports = {
    // A watcher is a form of worker process which invokes Cosmonaut's download system
    watchers: [],
    saveTo: null,
    concurrency: {
        downloadLimit: 5,
        uploadLimit: 5,
        total: 10
    },
    bandwidth: {
        downloadLimit: 0,
        uploadLimit: 0,
        limitByConnectionDown: false,
        limitByConnectionUp: false,
    },
    seeding: {
        // Set restrictions on seeding torrents, whichever occurs first of the following:
        limits: {
            // OPTIONAL: Number of milliseconds to permit seeding
            // Default: 7 Days / 1 Week
            duration: 1000 * 60 * 60 * 24 * 7,

            // OPTIONAL: Number of Kibibytes uploaded
            // Default: 100 Gibibytes
            dataUploaded: 1024 * 1024 * 100,

            // OPTIONAL: Data Upload relative to the torrent size
            // Default: 5xTorrent Size
            uploadMultiplier: 5
        }
    }
}


// Sample watchers:
// These watchers aim to move torrents at each stage of their lifecycle.
// Torrents which have yet to download, are stored in ~/torrents/pending.
// Torrents which are currently downloading are stored in ~/torrents/in progress
// Torrents which are currently seeding are stored in ~/torrents/seeding
// Torrents which have downloaded and finished their seeding requirements are
// stored in ~/torrents/completed
let watchers = [
    {
        watch: "~/Downloads/torrents/pending",
        onDownloadStart: {
            action: "move",
            destination: "~/torrents/in progress"
        },
        onDownloadFinish: null,
        onSeedingStart: null,
        onSeedingFinish: null
    },
    {
        watch: "~/Downloads/torrents/in progress",
        onDownloadStart: {},
        onDownloadFinish: {
            action: "move",
            destination: "~/torrents/seeding"
        },
        onSeedingStart: null,
        onSeedingFinish: null
    },
    {
        watch: "~/Downloads/torrents/seeding",
        onDownloadStart: {},
        onDownloadFinish: null,
        onSeedingStart: null,
        onSeedingFinish: null
    },
    {
        watch: "~/Downloads/torrents/in progress",
        onDownloadStart: {},
        onDownloadFinish: null,
        onSeedingStart: null,
        onSeedingFinish: {
            action: "move",
            destination: "~/torrents/completed"
        }
    }
]