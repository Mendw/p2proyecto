const express = require('express')
const app = express()
const http = require('http').createServer(app)
const localtunnel = require('localtunnel')

const client_io = require('socket.io-client')
const server_io = require('socket.io')(http)

const sjcl = require("./sjcl")
const fs = require("fs")

const difficulty = 4

var peers
var sockets

var blockchain
var tunnel

var needsNewline = false

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

function generateSerialized() {
    let pair = sjcl.ecc.elGamal.generateKeys(256)

    return {
        public: sjcl.codec.base64.fromBits(pair.public.x.concat(pair.public.y)),
        private: sjcl.codec.base64.fromBits(pair.private)
    }
}

function sign(plaintext, serializedPrivate) {
    private = new sjcl.ecc.elGamal.secretKey(
        sjcl.ecc.curves.c256,
        sjcl.ecc.curves.c256.field.fromBits(sjcl.codec.base64.toBits(serializedPrivate))
    )
}

function plaintext() {

}

function verify() {

}

class Transaction {
    constructor(data) {
        if (!data) return

        this.timestamp = data.timestamp
        this.type = data.type
        this.from = data.publicKey
        this.username = data.username
        this.signature = data.privateKey ? sign(this.toString(), data.privateKey) : data.signature
    }

    static genesis() {
        return new Transaction({
            type: "GENESIS"
        })
    }

    static parse(transactions) {
        return transactions.map(transaction => {
            return new Transaction(transaction)
        })
    }

    isValid() {
        return this.type == "GENESIS" || verify(this.toString(), this.signature, this.from)
    }

    toString() {
        return `${this.timestamp}<|>${this.type}<|>${this.from}<|>${this.username}`
    }
}

class Block {
    constructor(data) {
        if (!data) {
            this.lastHash = null
            this.transactions = [Transaction.genesis()]
            return
        } else {
            this.lastHash = data.lastBlock ? data.lastBlock.hash() : null
            this.timestamp = data.timestamp
            this.transactions = Transaction.parse(data.transactions)
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
        return this.lastHash == null && this.transactions.length === 1 && this.transactions[0].isValid()
    }

    isValid(prevHash) {
        return this.isGenesis() || this.isCorrectHash() && this.lastHash == prevHash && this.transactions.every(t => { t.isValid() })
    }

    hash() {
        return sjcl.codec.hex.fromBits(sjcl.hash.sha256.hash(this.toString()))
    }

    isCorrectHash() {
        return this.hash().slice(0, difficulty) == "0" * difficulty
    }

    mine() {
        while (!isCorrectHash()) {
            this.nonce++
        }
    }

    toString() {
        return `>${this.lastHash}|${this.timestamp}|${this.data}|${this.nonce}<`
    }
}

class Blockchain {
    constructor(data) {
        if (!data) {
            this.blocks = [Block.genesis()]
            this.pending = []
            return
        }
        this.blocks = Block.parse(data.blocks)
        this.pending = Transaction.parse(data.pending)
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
        }) && this.pending.every(t => {
            return t.isValid()
        })
    }
}

function addPeer(address) {
    peers.push(address)
    let socket = connectSocket(address)
    sockets.push({
        address: address,
        socket: socket,
    })
    console.log(`${peers ? `Peers: ${peers.length}` : ""} | ${blockchain ? `Blocks: ${blockchain.blocks.length} | Pending: ${blockchain.pending.length}` : "No blockchain"}`)
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
        }
    })
    if (whisper.blockchain) {
        let otherBC = new Blockchain(whisper.blockchain)
        if (!blockchain || otherBC.blocks.length > blockchain.blocks.length) {
            console.log("Copying blockchain")
            blockchain = otherBC
            console.log(`${peers ? `Peers: ${peers.length}` : ""} | ${blockchain ? `Blocks: ${blockchain.blocks.length} | Pending: ${blockchain.pending.length}` : "No blockchain"}`)
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
        console.log(data.username, data.password, data.signature)
    })
})

function initialize(localPort, local) {
    if (local)
        console.log("starting locally")

    try {
        fs.mkdirSync("./_public")
    } catch (err) {

    }
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
                console.log(`(${s.address}) was closed`)
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