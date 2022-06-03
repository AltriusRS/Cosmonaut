const bencode = require('bencode');


class MetaInfo {
    constructor(raw, path) {
        let parsed = bencode.decode(raw);
        this.torrentFile = path;
        this.announce = parsed.announce;
        if(this.announce !== undefined) {
            this.announce = this.announce.toString()
        }
        this.announceList = [];

        if (parsed['announce-list'] !== undefined) {
            this.announceList = parsed['announce-list'].map(item => item[0].toString())

            if(this.announceList.length > 0) {
                this.announce = this.announceList.shift();
            }
        }

        this.creationDate = new Date((parsed["creation date"] * 1000));

        this.createdBy = parsed['created by'];
        if(this.createdBy) this.createdBy = this.createdBy.toString();


        this.comment = parsed.comment;
        if(this.comment) this.comment = this.comment.toString();

        this.encoding = parsed.encoding;
        if(this.encoding) this.encoding = this.encoding.toString();

        this.info = new Info(parsed.info)
        this.rawInfo = parsed.info;

        this.urlList = [];

        if(parsed['url-list'] !== undefined) {
            if(parsed['url-list'].length > 0) {
                this.urlList = parsed['url-list'].map(x => x.toString());
            }
        }
    }
}

module.exports = MetaInfo;


class Info {
    constructor(parent) {
        this.mode = 0;
        if (parent.files !== undefined) {
            this.mode = 1;
            this.files = parent.files.map(f => {
                return {
                    length: f.length,
                    path: f.path[0].toString()
                }
            });
        } else this.files = []

        this.name = parent.name.toString();
        this.pieceLength = parent["piece length"];
        this.pieces = parent.pieces;
        this.length = parent.length;
        this.private = parent.private;
    }
}