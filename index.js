var app = require('express')()
var http = require('http').createServer(app)
var io = require('socket.io')(http)

var asd = require('./utils')

console.log(asd.test)

var args = process.argv.slice(2);
switch (args.length) {
    case 1:
        var port = parseInt(args[0])
        if (port != NaN) {
            console.log(`One argument provided ${args}, starting blockchain...`)
            startBlockChain(port)
        }
        else {
            console.log("Invalid port")
            process.exit();
        }
        break
    case 3:
        var localPort = parseInt(args[0])
        var remotePort = parseInt(args[2])

        if (localPort != NaN && remotePort != NaN && isIP(args[1])) {
            console.log(`Three arguments provided ${args}, connecting...`)
            connectToBlockChain(localPort, args[1], remotePort)
        }
        else {
            console.log("Invalid something")
            process.exit();
        }
        break;
    default:
        process.exit()
        break;
}

function startServer(localPort) {

}

function isIP(ip) {
    console.log(ipre.test(ip))
    return ipre.test(ip)
}

function connectToBlockChain(localPort, address, remotePort) {
    startServer(localPort)
    
}

function startBlockChain(port) {

}

app.get('/w', function (req, res) {
    res.sendFile(__dirname + '/html/index.html')
})

io.on('connection', function (socket) {
    console.log('New connection')
})

http.listen(3000, function () {
    console.log("server started @ 3000")
})