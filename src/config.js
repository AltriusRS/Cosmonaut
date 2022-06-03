const getAppDataPath = require("appdata-path");
const fs = require("fs");
const defaults = require("./defaultConfig.js");

const path = getAppDataPath("Cosmonaut");

if (!fs.existsSync(path)) fs.mkdirSync(path);
if (!fs.existsSync(path + "\\settings.json")) fs.writeFileSync(path + "\\settings.json", JSON.stringify(defaults))

class Config {
    constructor() {
        let temp = require(path + "\\settings.json");

        this.watchers = temp.watchers || defaults.watchers;
        this.saveTo = temp.saveTo || defaults.saveTo;
        this.concurrency = temp.concurrency || defaults.concurrency;
        this.bandwidth = temp.bandwidth || defaults.bandwidth;
        this.seeding = temp.seeding || defaults.seeding;

        process.on("before-exit", () => {
            fs.writeFileSync(path + "\\settings.json", JSON.stringify(defaults))
        })
    }
}

module.exports = Config;