const crypto = require('./crypto.js')
const difficulty = 4

class Block {
    constructor(data) {
        this.lastHash = data.lastHash
        this.timestamp = data.timestamp
        this.username = data.username
        this.public = data.public
        this.signature = data.signature
        this.nonce = data.nonce ? data.nonce : 0
    }

    hash() {
        return crypto.hash(this.toString())
    }

    mined() {
        return this.hash().substring(0, difficulty) == "0".repeat(difficulty)
    }

    isValid(prev) {
        if (this.lastHash == null) return true;
        return this.lastHash == null || this.mined() && this.lastHash == prev && crypto.verify(this)
    }

    mine() {
        while (!this.mined())
            this.nonce += 1;
    }

    toString() {
        return `${this.lastHash}${this.timestamp}${this.username}${this.public}${this.signature}${this.nonce}`
    }
}

class Blockchain {
    /**
     * @param {{blocks: Block[], logged: {username: String, timestamp: String, public: String, signature: String}[]}} data 
     */
    constructor(data) {
        if (!data) {
            this.blocks = [new Block({ lastHash: null })]
            this.logged = []
            return
        } else {
            this.blocks = data.blocks.map(block => { return new Block(block) })
            this.logged = data.logged;
        }
    }

    /**
     * @returns {Boolean}
     */
    isValid() {
        let prevHash = null
        return this.blocks.every(block => {
            return block instanceof Block && block.isValid(prevHash) && ((prevHash = block.hash()) || true)
        })
    }

    /**
     * @param {{username:String, publicKey:String, timestamp:String, signature:String}} data
     */
    search(data) {
        let username = data.username
        let publicKey = data.public

        let result = {
            userExists: false,
            correctStoredPublic: false,
            correctLoginPublic: false,
            logged: false,
        }

        if (!(username && publicKey)) {
            return result
        }

        this.logged.forEach(user => {
            if (user.logged && username == user.username) {
                result.logged = true
                result.correctLoginPublic = user.public == publicKey
            }
        })

        this.blocks.forEach(block => {
            if (block.username == username) {
                result.userExists = true
                result.correctStoredPublic = block.public == publicKey
            }
        })

        return result
    }
    /**
     * @param {{username:String, public:String, timestamp:String, signature:String}} data 
     */
    push(data) {
        if (crypto.verify(data)) {
            let block = new Block({
                lastHash: this.blocks[this.blocks.length - 1].hash(),
                timestamp: data.timestamp,
                username: data.username,
                public: data.public,
                signature: data.signature,
            })
            block.mine()
            this.blocks.push(block)
        }
    }

    /**
     * @param {{username:String, public:String, timestamp:String, signature:String}} data 
     */
    login(data) {
        if (this.logged.every(entry => {
            return !entry.logged || data.username != entry.username
        })) {
            let index = this.logged.findIndex(entry => {
                return data.username == entry.username && data.public == entry.public
            })
            data.logged = true;
            if (index != -1) {
                data.logged = true;
                this.logged[index] = data
            }
            else {
                this.logged.push(data)
            }
            return true
        } else {
            return false
        }
    }

    /**
     * @param {{username:String, public:String, timestamp:String, signature:String}} data 
     */
    logout(data) {
        let index = this.logged.findIndex(entry => {
            return data.username == entry.username && data.public == entry.public
        })
        if (index != -1) {
            data.logged = false;
            this.logged[index] = data
            return true
        }
        return false
    }
}

module.exports = exports = Blockchain