const express = require('express')
const app = express()
const http = require('http').createServer(app)
const localtunnel = require('localtunnel')

const client_io = require('socket.io-client')
const server_io = require('socket.io')(http)

const sjcl = require("./sjcl")
const fs = require("fs")

const difficulty = 4
var isLocal

var peers
var sockets

var blockchain
var tunnel

var miningInfo

function getTunnel(port) {
    let tunnel = localtunnel(port, {
        subdomain: `dml-p2p-${port}`
    }, (err, tunnel) => {
        if (err) {
            console.log(err)
        }
        console.log(`Connected at ${tunnel.url}`)
        peers.push(tunnel.url + "/blockchain")
    })

    tunnel.on('request', info => {
        console.log(`New ${info.method} request`)
    })

    tunnel.on('error', err => {
        console.log("Caught an error")
        console.dir(err);
        tunnel.close()
    })

    tunnel.on('close', () => {
        console.log("Tunnel is cancelled")
    })

    return tunnel
}

function searchBlockchain(username, public) {
    if (!blockchain || !blockchain.blocks) return -1
    let rv = 1
    blockchain.blocks.slice(1).forEach(block => {
        if (block.transaction.username == username) {
            rv = block.transaction.public == public ? 3 : 0
        }
        if (rv != 1)
            return
    })

    return rv
}

function sign(plaintext, serializedPrivate) {
    private = new sjcl.ecc.elGamal.secretKey(
        sjcl.ecc.curves.c256,
        sjcl.ecc.curves.c256.field.fromBits(sjcl.codec.base64.toBits(serializedPrivate))
    )
}

function deserialize(public) {
    return new sjcl.ecc.ecdsa.publicKey(
        sjcl.ecc.curves.c256,
        sjcl.codec.base64.toBits(public)
    )
}

function verify(data) {
    let signature = sjcl.codec.base64.toBits(data.signature)
    let public = deserialize(data.public)
    let plaintext = `[${data.username}][${data.public}][${data.timestamp}]`
    try {
        return public.verify(sjcl.hash.sha256.hash(plaintext), signature)
    } catch (err) {
        console.dir(err)
        return false
    }
}

class Transaction {
    constructor(data) {
        this.timestamp = data.timestamp
        this.public = data.public
        this.username = data.username
        this.signature = data.privateKey ? sign(this.toString(), data.privateKey) : data.signature
    }

    static parse(transactions) {
        return transactions.map(transaction => {
            return new Transaction(transaction)
        })
    }

    isValid() {
        return verify({
            username: this.username,
            timestamp: this.timestamp,
            signature: this.signature,
            public: this.public
        })
    }

    toString() {
        return `[${this.username}][${this.timestamp}][${this.signature}][${this.public}]`
    }
}

class Block {
    constructor(data) {
        if (!data) {
            this.lastHash = null
            this.timestamp = undefined
            this.transaction = undefined
            this.nonce = 0
            return
        } else {
            this.lastHash = data.lastBlock ? data.lastBlock.hash() : null
            this.timestamp = data.timestamp
            this.transaction = data.transaction
            this.nonce = data.nonce
        }
    }

    static genesis() {
        return new Block(null)
    }

    static parse(blocks) {
        return blocks.map(block => {
            return new Block(block)
        })
    }

    isGenesis() {
        return this.lastHash == null
    }

    isValid(prevHash) {
        return this.isGenesis() || this.isCorrectHash() && this.lastHash == prevHash && this.transaction.isValid()
    }

    hash() {
        return sjcl.codec.hex.fromBits(sjcl.hash.sha256.hash(this.toString()))
    }

    isCorrectHash() {
        return this.hash().substring(0, difficulty) == "0".repeat(difficulty)
    }

    mine() {
        this.nonce = 0
        miningInfo = ""
        while (!this.isCorrectHash()) {
            this.nonce += 1;
            if (this.nonce % 10000 == 1) {
                miningInfo += "."
                logState()
            }
        }
        this.hash = this.hash()
        miningInfo += ` ${this.hash.substring(0, 10)}`
    }

    toString() {
        return `>${this.lastHash}|${this.timestamp}|${this.transaction}|${this.nonce}<`
    }
}

function logState() {
    process.stdout.cursorTo(0, 0)
    process.stdout.clearScreenDown()
    process.stdout.write(`running ${isLocal ? 'locally' : 'remotely'}\n`)
    process.stdout.write(`[Peers      | ${peers.length}]\n`)
    if (blockchain)
        process.stdout.write(`[Blockchain | ${blockchain.blocks.length}]\n`)
    if (miningInfo)
        process.stdout.write(miningInfo + '\n')
}

class Blockchain {
    constructor(data) {
        if (!data) {
            this.blocks = [Block.genesis()]
            return
        }
        this.blocks = Block.parse(data.blocks)
    }

    isValid() {
        let prevHash = null
        let truth
        return this.blocks.every(function (b) {
            if (!b instanceof Block)
                return false

            truth = b.isValid(prevHash)
            prevHash = b.hash()
            return truth
        })
    }

    push(transaction) {
        if (transaction.isValid()) {
            let block = new Block({
                lastHash: this.blocks[this.blocks.length - 1].hash,
                timestamp: new Date().toISOString(),
                transaction: transaction,
            })
            block.mine()
            this.blocks.push(block)
            logState()
        } else console.log("Not valid")
    }
}

function addPeer(address) {
    peers.push(address)
    let socket = connectSocket(address)
    sockets.push({
        address: address,
        socket: socket,
        attempts: 0,
    })
}

app.use(express.static(__dirname + '/html'))

app.get('/', (req, res) => {
    res.status(404).send("Sorry, couldn't find that")
})

app.get('/client', function (req, res) {
    let host = req.headers.host
    if (host && host.slice(0, 10) == 'localhost:')
        res.sendFile(__dirname + '/html/index.html')
    else {
        res.status(403).send("<h1 style='text-align:center'>403 Forbidden</h1></br><p style='text-align:center'>Frick off</p>")
    }
})

function emitWhisper(socket) {
    socket.emit('whisper', {
        peers: peers,
        blockchain: blockchain
    })
}

function isNewPeer(remotePeer) {
    return peers.every(localPeer => {
        return remotePeer != localPeer
    })
}

function parseWhisper(whisper) {
    whisper.peers.forEach((remotePeer) => {
        if (isNewPeer(remotePeer)) {
            addPeer(remotePeer)
            logState()
        }
    })
    if (whisper.blockchain) {
        let otherBC = new Blockchain(whisper.blockchain)
        if (otherBC.isValid() && (!blockchain || otherBC.blocks.length > blockchain.blocks.length)) {
            blockchain = otherBC
            logState()
        }
    }
}

function connectSocket(address) {
    let socket = client_io(address)
    socket.on('welcome', message => {
        parseWhisper(message)
        socket.emit('whisper', {
            peers: peers
        })
    })

    socket.on('whisper', (whisper) => {
        parseWhisper(whisper)
    })

    socket.on('error', (error) => {
        console.log(`Socket client error, (${error})`)
    })

    socket.on('reconnect', (data) => {
        console.log(`trynna reconnect {${data}}`)
    })

    return socket
}

server_io.of('/blockchain').on('connection', (socket) => {
    socket.emit('welcome', {
        peers: peers,
        blockchain: blockchain
    })

    socket.on('whisper', whisper => {
        parseWhisper(whisper)
    })
})

server_io.of('/client').on('connection', socket => {
    socket.emit('files', {
        filenames: fs.readdirSync("./_public")
    })

    socket.on('login', data => {
        if (verify(data)) {
            switch (searchBlockchain(data.username, data.public)) {
                case 2:
                case 3:
                    socket.emit('login-approved')
                    return
            }
        }
        socket.emit('login-denied')
    })

    socket.on('register', data => {
        if (verify(data) && searchBlockchain(data.username, data.public) == 1) {
            socket.emit('register-approved')
            blockchain.push(new Transaction(data))
            return
        }
        socket.emit('register-denied')
    })
})

function initialize(localPort, local) {
    isLocal = local
    if (local)
        console.log("starting locally")

    try {
        fs.mkdirSync("./_public")
    } catch (err) { }

    try {
        fs.mkdirSync("./_temp")
    } catch (err) { }

    peers = []

    if (local) {
        peers.push(`http://localhost:${localPort}/blockchain`)
    } else {
        tunnel = getTunnel(localPort)
    }

    sockets = []

    http.listen(localPort, function () {
        console.log(`server started at port ${localPort}`)
    })

    setInterval(() => {
        sockets.forEach(s => {
            if (s.socket.connected) {
                emitWhisper(s.socket)
            } else {

            }
        })
    }, 5000)
}

function start(localPort, local) {
    blockchain = new Blockchain()
    initialize(localPort, local)
}

function connect(localPort, remoteAddress, local) {
    initialize(localPort, local)
    addPeer(remoteAddress + "/blockchain")
}

function closeTunnel() {
    console.log("closing")
    tunnel.close()
}

module.exports = exports = {
    connect: connect,
    start: start,
    close: closeTunnel,
}