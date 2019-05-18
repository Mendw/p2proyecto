const app = require('express')()
const http = require('http').createServer(app)

const client_io = require('socket.io-client')
const server_io = require('socket.io')(http)

const blockchain = []
const peers = new Set()

class Block {
    constructor(lastHash, timestamp, data) {
        this.lastHash = lastHash
        this.timestamp = timestamp
        this.data = data
        this.nonce = 0
    }

    isCorrectHash(){

    }

    mine(){
        while(!isCorrectHash()){
            this.nonce++
        }
    }
}

app.get('/client', function (req, res) {
    res.sendFile(__dirname + '/html/index.html')
})

server_io.on('connection', function (socket) {
    socket.emit('welcome', {
        blockchain: {},
        peers: peers,
    })
})

function start(localPort) {
    peers.clear()

    http.listen(localPort, function () {
        console.log(`server started @ ${localPort}`)
    })
}

function connect(localPort, address, remotePort) {
    start(localPort)
    var socket = client_io.connect(`http://${address}:${remotePort}`)

    socket.on('welcome', (msg) => {
        console.log(msg)
    })
}

module.exports = exports = {
    connect: connect,
    start: start,
}