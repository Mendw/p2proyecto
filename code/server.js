const express = require('express')
const app = express()
const http = require('http').createServer(app)

const client_io = require('socket.io-client')
const server_io = require('socket.io')(http)
const stream_io = require('socket.io-stream')

const fetch = require('node-fetch')
const Blockchain = require('./blockchain')

const crypto = require('./crypto')
const fs = require("fs")

const path = require('path')

const base_path = path.join(__dirname, '..', 'files/public')
const chain_path = path.join(__dirname, '..', 'files/blockchain.json')

const state = {
    blockchain: new Blockchain(),
    peers: [],
    messages: [],
    local: true,
    address: '',
    port: null,
    clients: [],
    editing: false,
    editors: [],
}

app.use(express.json())
app.use(express.urlencoded({ extended: true }))

app.use((req, res, next) => {
    pushMessage(`[${req.method} | ${req.url}]`)
    next()
})

app.use(express.static(__dirname + '/html'))

app.post('/text/', (req, res) => {
    let body = req.body
    fs.readFile(`${base_path}${body.path}/${body.filename}`, 'utf-8', (err, text) => {
        if (err) {
            res.status(404).send(err)
        } else {
            state.editing = {
                name: body.filename,
                text: text,
            };
            res.send(text)
        }
    })
})

app.get('/:type?*', (req, res) => {
    let query = req.query
    if (query != {})
        res.sendFile(`${base_path}${query.path}/${query.filename}`)
    else {
        res.sendStatus(404)
    }
})

const cacheSize = 50
const recievedMessages = []
const recievedSearches = []

function getAddress() {
    return `http://${state.address}:${state.port}`
}

function logState() {
    process.stdout.cursorTo(0, 0)
    process.stdout.clearScreenDown()

    if (state.local != null) {
        if (state.local) {
            console.log(`Running locally at ${state.address ? `${state.address}:${state.port}` : "[?]"}`)
        } else {

        }
    }
    if (state.blockchain) {
        let connected = state.blockchain.logged.reduce((acc, user) => acc += user.logged ? 1 : 0, 0)
        console.log(`[B] [${state.blockchain.blocks.length - 1} : ${connected}]`)
    }

    if (state.peers) {
        let connected = state.peers.reduce((acc, peer) => acc += peer.socket.connected ? 1 : 0, 0)
        console.log(`[S] [${state.peers.length} : ${connected}]`)
    }

    if (state.clients) {
        let connected = state.clients.reduce((acc, socket) => acc += socket.connected ? 1 : 0, 0)
        console.log(`[C] [${state.clients.length} : ${connected}]`)
    }

    if (state.messages != null) {
        state.messages = state.messages.filter(message => {
            return Date.now() < message.expiration
        })
        state.messages.forEach(message => {
            process.stdout.write('-: ')
            console.dir(message.text)
        })
    }
}

function pushMessage(text, duration) {
    state.messages.push({
        text: text,
        expiration: Date.now() + 1000 * (duration ? duration : 10)
    })
    logState()
}

function isNewAdress(address) {
    return state.peers.every(address_ => address_ != address) &&
        address != getAddress() &&
        address != `http://localhost:${state.port}`
}

function saveBlockchain() {
    fs.writeFile(chain_path, JSON.stringify(state.blockchain.blocks), (err) => {
        if (err)
            pushMessage(err)
    })
}

function parse(data) {
    if (data.editing && data.editing.name) {
        let index = state.editors.findIndex(value => value && value.address == data.address)
        if (index != -1) {
            state.editors[index].name = data.editing.name
        } else {
            pushMessage({
                address: data.address,
                name: data.editing.name,
                text: data.editing.text
            })
            state.editors.push({
                address: data.address,
                name: data.editing.name,
                text: data.editing.text
            })
        }
    }

    data.peers.forEach(address => {
        if (isNewAdress(address)) {
            addPeer(address)
        }
    })

    if (data.blockchain) {
        let blockchain = new Blockchain(data.blockchain)
        if (blockchain.isValid()) {
            let logged = state.blockchain ? state.blockchain.logged : null
            if (!state.blockchain || blockchain.blocks.length > state.blockchain.blocks.length) {
                state.blockchain = blockchain
                pushMessage("Copied blockchain")
                saveBlockchain()
            } else;

            if (logged && logged.length > 0) {
                let delta = false
                blockchain.logged.forEach(remote => {
                    let index = logged.findIndex(local => remote.username == local.username)
                    if (index != -1) {
                        if (logged[index].public == remote.public) {
                            if (new Date(logged[index].timestamp) < new Date(remote.timestamp)) {
                                logged[index] = remote
                                delta = true
                            }
                        } else {
                            //Vainas raras
                        }
                    } else {
                        logged.push(remote)
                        delta = true
                    }
                })
                state.blockchain.logged = logged
                if (delta) {
                    logState()
                }
            } else {
                state.blockchain.logged = blockchain.logged
                logState()
            }
        }

    }
}

function hashMessage(message) {
    let plaintext = `${message.auth.public}${message.auth.timestamp}${message.text}`
    return crypto.hash(plaintext)
}

function recieve(message) {
    if (message && message.auth && crypto.verify(message.auth)) {
        let hash = hashMessage(message)
        if (recievedMessages.every(m => m.auth.timestamp != message.auth.timestamp || hash != hashMessage(m))) {
            if (recievedMessages.length >= cacheSize) recievedMessages.shift()
            recievedMessages.push(message)
            spread('message', message)
            server_io.of('/local').emit('message', message)
        } else {
        }
    } else {
    }
}


function toWhom(message) {
    return state.peers.filter(peer => message.recipients.findIndex(address => address == peer.address) == -1)
}

function spread(event, message) {
    let newRec = toWhom(message)
    newRec.map(peer => peer.address).forEach(address => message.recipients.push(address))
    newRec.forEach(peer => {
        peer.socket.emit(event, message)
    })
}

/**
 * @param {String} address 
 */
function remoteSocket(address) {
    let socket = client_io(`${address}/remote`)

    socket.on('connect', () => {
        pushMessage(`now connected to ${address}`)
    })

    socket.on('blockchain', data => {
        parse(data)
    })

    socket.on('message', message => {
        recieve(message)
    })

    socket.on('error', error => {
        pushMessage(error.toString())
    })

    return socket
}

function addPeer(address) {
    if (state.peers.every(peer => peer.address != address)) {
        state.peers.push({
            address: address,
            socket: remoteSocket(address)
        })
        logState()
    }
}

server_io.of('/remote').on('connection', socket => {
    let addresses = state.peers.map(peer => peer.address)
    if ((state.address || state.local) && state.port) addresses.push(getAddress())
    socket.emit('blockchain', {
        blockchain: state.blockchain,
        peers: addresses,
        editing: state.editing,
        address: getAddress()
    })

    socket.on('blockchain', blockchain => {
        parse(blockchain)
    })

    socket.on('message', message => {
        recieve(message)
    })
})

function login(socket, data) {
    if (data && crypto.verify(data)) {
        let rv = state.blockchain.search(data)
        if (rv && rv.userExists && rv.correctStoredPublic && !rv.logged && state.blockchain.login(data)) {
            socket.emit('login-approved')
            logState()
            return
        } else {
            pushMessage(`${!!rv} ${rv.userExists} ${rv.correctStoredPublic} ${!rv.logged}`)
        }
    }
    socket.emit('login-denied')
}

function register(socket, data) {
    if (data && crypto.verify(data)) {
        let rv = state.blockchain.search(data)
        if (rv && !rv.userExists) {
            state.blockchain.push(data)
            saveBlockchain()
            socket.emit('register-approved')
            logState()
            login(socket, data)
            return
        }
    }
    socket.emit('register-denied')
}

function logout(data) {
    if (data && crypto.verify(data)) {
        let rv = state.blockchain.search(data)
        if (rv && rv.userExists && rv.logged && rv.correctLoginPublic) {
            state.blockchain.logout(data)
            logState()
            return;
        }
    }
}

bienvenidas = [
    "Bienvenido al chat global, preséntate o comparte una historia",
    "Bienvenido al chat global, ¿cuál es tu tipo favorito de sistema distribuido?",
    "Bienvenido al chat global, dile hola a tus peers",
    "Bienvenido al chat global, ¿desde donde te conectas?",
    "Bienvenido al chat global, ¿cuándo terminas carga?"
]
server_io.of('/local').on('connection', socket => {
    state.clients.push(socket)
    socket.emit('welcome', {
        message: bienvenidas[Math.floor(Math.random() * (bienvenidas.length))]
    })

    socket.on('getMessages', () => {
        socket.emit('messages', recievedMessages.map(message => (
            {
                message: message.text,
                from: message.auth.public
            })))
    })

    socket.on('message', message => {
        if (message && message.auth && crypto.verify(message.auth)) {
            message.recipients = []
            spread('message', message)
        }
    })

    socket.on('scan-directory', data => {
        if (data && data.auth && crypto.verify(data.auth)) {
            pushMessage(`reading ${base_path}${data.path}`)
            fs.readdir(`${base_path}${data.path}`, { withFileTypes: true }, (err, dirents) => {
                if (err) {
                    pushMessage(err, 5)
                } else {
                    socket.emit('directory', dirents.map(dirent => {
                        return {
                            type: dirent.isFile() ? 'file' : dirent.isDirectory() ? 'folder' : 'unknown',
                            name: dirent.name,
                        }
                    }))
                }
            })
        }
    })

    socket.on('get-editors', () => {
        socket.emit('editors', state.editors)
    })

    stream_io(socket).on('get-file', (stream, data) => {
        fs.createReadStream(`${base_path}${data.path}/${data.filename}`).pipe(stream)
    })

    socket.on('login', data => {
        login(socket, data)
    })

    socket.on('register', data => {
        register(socket, data)
    })

    socket.on('logout', data => {
        state.clients.filter(client => client.id != socket.id)
        logout(data)
    })

    socket.on('save-file', data => {
        fs.writeFile(`${base_path}${data.path}/${data.filename}`, data.text, {
            encoding: 'utf-8'
        }, (err) => {
            if (err) {
                pushMessage("Nope")
            }
        })
    })
});

server_io.of('/edit').on('connection', socket => {
    socket.on('gimmie', () => {
        if (state.editing != {})
            socket.emit('yeet', {
                data: state.editing
            })
    })

    socket.on('text-change', data => {
        socket.broadcast.emit('text-change', data)
    })
})

function start(localP, remoteP, remoteA) {
    state.port = localP ? localP : 1101
    http.listen(state.port, () => {
        logState()
    });

    (async () => {
        state.address = await fetch('https://api.ipify.org').then(response => response.text()).catch(err => pushMessage(err))
        logState()

        if (remoteP) {
            if (remoteA) {
                addPeer(`http://${remoteA}:${remoteP}`)
            } else {
                addPeer(`http://${state.address}:${remoteP}`)
            }
        }

        setInterval(() => {
            let addresses = state.peers.map(peer => peer.address)
            if ((state.address || state.local) && state.port) addresses.push(getAddress())
            server_io.of('/local').emit('rooms', state.editors)
            state.peers.forEach(peer => {
                peer.socket.emit('blockchain', {
                    blockchain: state.blockchain,
                    peers: addresses,
                    editing: state.editing,
                    address: getAddress()
                })
            })
            logState()
        }, 2000);
    })()
}

function close() {
    console.log("Closing server...")
}

module.exports = exports = {
    start: start,
    close: close,
}