const express = require('express')
const app = express()
const http = require('http').createServer(app)
const localtunnel = require('localtunnel')

const client_io = require('socket.io-client')
const server_io = require('socket.io')(http)

const sjcl = require("./sjcl")
const fs = require("fs")

const basePath = "./_public"

const difficulty = 4
var isLocal

var file_info

var peers
var sockets

var blockchain
var tunnel

var extraInfo


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
    if (!blockchain || !blockchain.blocks) return
    let rv = {
        userExists: false,
        correctStoredPublic: false,
        correctLoginPublic: false,
        logged: false,
    }

    blockchain.logged.forEach(user => {
        if (user.logged && username == user.username) {
            rv.logged = true
            rv.correctLoginPublic = user.public == public
            return
        }
    })

    blockchain.blocks.slice(1).forEach(block => {
        if (block.transaction.username == username) {
            rv.userExists = true
            rv.correctStoredPublic = block.transaction.public == public
            return
        }
    })

    return rv
}

function sign(plaintext, serializedSecret) {
    let secret = new sjcl.ecc.ecdsa.secretKey(
        sjcl.ecc.curves.c256,
        sjcl.ecc.curves.c256.field.fromBits(sjcl.codec.base64.toBits(serializedSecret))
    )

    return sjcl.codec.base64.fromBits(secret.sign(sjcl.hash.sha256.hash(plaintext)))
}

function deserialize(public) {
    return new sjcl.ecc.ecdsa.publicKey(
        sjcl.ecc.curves.c256,
        sjcl.codec.base64.toBits(public)
    )
}

function verify(data) {
    if (!data) return false
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
            this.type = data.type
            this.lastHash = data.lastHash
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
        extraInfo = ""
        while (!this.isCorrectHash()) {
            this.nonce += 1;
            if (this.nonce % 10000 == 1) {
                extraInfo += "."
                logState()
            }
        }
        this.hash = this.hash()
        extraInfo += ` ${this.hash}`
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

    if (blockchain) {
        let logged = 0
        blockchain.logged.forEach(user => { if (user.logged) logged++ })
        process.stdout.write(`[Blockchain | ${blockchain.blocks.length} · ${logged}]\n`)
    }
    if (extraInfo)
        process.stdout.write(extraInfo + '\n')
}

class Blockchain {
    constructor(data) {
        this.logged = data ? data.logged : []
        this.blocks = data ? Block.parse(data.blocks) : [Block.genesis()]
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
        }
    }

    login(data) {
        if (this.logged.every(entry => {
            !entry.logged || data.username != entry.username
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
            logState()
        }
    }

    logout(data) {
        let index = this.logged.findIndex(entry => {
            return data.username == entry.username && data.public == entry.public
        })
        if (index != -1) {
            data.logged = false;
            this.logged[index] = data
            logState()
        }
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

function consider(path, name, isFolder) {
    if (isFolder) {
        if (!file_info.some(file => {
            if (file.name == name
                && file.path == path
                && file.type == "folder")
                return file.found = true
        }))
            file_info.push({
                name: name,
                path: path,
                type: "folder",
                found: true
            })
        return
    }
    if (!file_info.some(file => {
        if (file.name == name
            && file.path == path
            && file.type == "file")
            return file.found = true
    })) {
        file_info.push({
            name: name,
            path: path,
            share: "public",
            type: "file",
            found: true
        })
    }
}

function explore(path) {
    let files = fs.readdirSync(`${basePath}${path ? `/${path}` : ''}`, {
        withFileTypes: true,
    })
    files.forEach(dirent => {
        if (dirent.isDirectory()) {
            consider(path ? path : '', dirent.name, true)
            explore(`${path ? `${path}/` : ''}${dirent.name}`)
        } else if (dirent.isFile()) {
            consider(path ? path : '', dirent.name)
        }
    })
}

function exploreAll() {
    fs.readFile('file_info.json', 'utf8', (err, data) => {
        if (err)
            return
        file_info = JSON.parse(data)
        explore()

        let cleanFiles = []
        file_info.forEach(file => {
            if (file.found) {
                cleanFiles.push({
                    name: file.name,
                    path: file.path,
                    share: file.share,
                    type: file.type
                })
            }
        })
        file_info = cleanFiles
        fs.writeFile('file_info.json', JSON.stringify(file_info), (err) => {
            if (err)
                console.dir(err)
        })
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
        if (otherBC.isValid()) {
            let logged = blockchain ? blockchain.logged : null
            if (!blockchain || otherBC.blocks.length > blockchain.blocks.length) {
                blockchain = otherBC
                extraInfo = "Copied a Blockchain"
                logState()
            }

            if (logged && logged.length > 0) {
                let change = false
                otherBC.logged.forEach(user_r => {
                    let index = logged.findIndex(user_l => {
                        return user_r.username == user_l.username
                    })

                    if (index != -1) {
                        if (logged[index].public == user_r.public) {
                            if (new Date(logged[index].timestamp) < new Date(user_r.timestamp)) {
                                logged[index] = user_r
                                change = true
                            }
                        } else {
                            //Vainas raras
                        }
                    } else {
                        logged.push(user_r)
                        change = true
                    }
                })
                if (change) {
                    logState()
                }
                blockchain.logged = logged
            }
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

function login(socket, data) {
    if (verify(data)) {
        let rv = searchBlockchain(data.username, data.public)
        if (rv && rv.userExists && rv.correctStoredPublic && !rv.logged) {
            blockchain.login(data)
            socket.emit('login-approved')
            return
        }
    }
    socket.emit('login-denied')
}

function register(socket, data) {
    if (verify(data)) {
        let rv = searchBlockchain(data.username, data.public)
        if (rv && !rv.userExists) {
            blockchain.push(new Transaction(data))
            socket.emit('register-approved')
            login(socket, data)
            return
        }
    }
    socket.emit('register-denied')
}

function logout(data) {
    if (verify(data)) {
        let rv = searchBlockchain(data.username, data.public)
        if (rv && rv.userExists && rv.logged && rv.correctLoginPublic) {
            blockchain.logout(data)
        }
    }
}

server_io.of('/client').on('connection', socket => {
    socket.on('scan-directory', data => {
        let rv = []
        if (data.auth && verify(data.auth) && data.path || data.path == '') {
            file_info.forEach(file => {
                if (file.path == data.path && (
                    file.type == "folder" ||
                    file.share == "public" ||
                    file.share instanceof Array && file.owner &&
                    file.owner.username == data.username && file.owner.public == data.public ||
                    file.share.some(element => {
                        return element.username == data.username &&
                            element.public == data.public
                    })))
                    rv.push({
                        name: file.name,
                        type: file.type,
                        share: file.share,
                    })
            })
            socket.emit('directory', {
                filenames: rv
            })
        } else {
            //no es valido
        }
    })

    socket.on('get-file', data => {
        if (data.auth && verify(data.auth))
            socket.emit('file', {
                data: fs.readFileSync(`${basePath}${data.path ? `/${data.path}` : ''}/${data.name}`)
            })
    })

    socket.on('login', data => {
        login(socket, data)
    })

    socket.on('register', data => {
        register(socket, data)
    })

    socket.on('logout', data => {
        logout(data)
    })
})

function parseBlockchain() {
    try {
        let bchain = JSON.parse(fs.readFileSync('./blockchain/blockchain.json', 'utf8'))
        if (bchain) blockchain = new Blockchain(bchain)
        extraInfo = "Parsed blockchain"
        logState()
    } catch (err) {

    }
}

function initialize(localPort, local) {
    isLocal = local
    if (local)
        console.log("starting locally")

    try {
        fs.mkdirSync(basePath)
    } catch (err) { }

    peers = []

    parseBlockchain()
    exploreAll()

    if (local) {
        peers.push(`http://localhost:${localPort}/blockchain`)
    } else {
        tunnel = getTunnel(localPort)
    }

    sockets = []

    http.listen(localPort, function () {

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

function close(local) {
    if (!local) closeTunnel
    if (blockchain) try {
        blockchain.logged = []
        fs.writeFileSync('./blockchain/blockchain.json', JSON.stringify(blockchain))
    } catch (err) { }
}

module.exports = exports = {
    connect: connect,
    start: start,
    close: close,
}