const app = require('express')()
const http = require('http').createServer(app)
const localtunnel = require('localtunnel')

const client_io = require('socket.io-client')
const server_io = require('socket.io')(http)

const sjcl = require("./sjcl")

const difficulty = 4

var peers
var sockets

var blockchain

function getTunnel(port) {
    let tunnel = localtunnel(port, {
        subdomain: `p2proyecto${port}`
    }, (err, tunnel) => {
        console.log(`Connected at ${tunnel.url}`)
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
        return `${this.lastHash}|${this.timestamp}|${this.data}|${this.nonce}`
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
}

app.get('/client', function (req, res) {
    res.sendFile(__dirname + '/html/index.html')
})

function emitWhisper(socket) {
    socket.emit('whisper', {
        peers: peers,
        blockchain: blockchain
    })
}

function isNewPeer(remotePeer) {
    return peers.every(localPeer => {
        return remotePeer == localPeer
    })
}

function parseWhisper(whisper) {
    whisper.peers.forEach((remotePeer) => {
        if (isNewPeer(remotePeer)) {
            addPeer(remotePeer.address, remotePeer.port)
        }
    })
    if (whisper.blockchain) {
        let otherBC = new Blockchain(whisper.blockchain)
        if (!blockchain || otherBC.blocks.length > blockchain.blocks.length) {
            console.log("Copying blockchain")
            blockchain = otherBC
        }
    }
}

function connectSocket(address) {

    let socket = client_io.connect(address)
    socket.on('whisper', (whisper) => {
        parseWhisper(whisper)
    })

    return socket
}

server_io.on('connection', (socket) => {
    emitWhisper(socket)

    socket.on('whisper', (whisper) => {
        parseWhisper(whisper)
    })
})

function initialize(localPort) {
    let tunnel = getTunnel(localPort)

    peers = [
        tunnel.url,
    ]

    sockets = []

    http.listen(localPort, function () {
        console.log(`server started @ ${localPort}`)
    })

    setInterval(() => {
        //console.log(peers)
        sockets.forEach(s => {
            if (s.socket.connected) {
                emitWhisper(s.socket)
            }
        })
    }, 5000)

    setInterval(() => {
        console.log(blockchain)
    }, 10000)
}

function start(localPort) {
    blockchain = new Blockchain()
    initialize(localPort)
}

function connect(localPort, remoteAddress) {
    initialize(localPort)
    addPeer(remoteAddress)
}

module.exports = exports = {
    connect: connect,
    start: start,
}