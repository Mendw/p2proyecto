var blockchain = require('./blockchain')
var utils = require('./utils')
var args = process.argv.slice(2);

process.stdin.resume();

process.on('beforeExit', (code) => {
    blockchain.close()
});
process.on('SIGINT', () => {
    blockchain.close()
    process.exit()
});
process.on('uncaughtException', () => {
    blockchain.close()
    process.exit()
});

let localPort, remotePort
var start = () => {
    switch (args.length) {
        case 1:
            localPort = parseInt(args[0])
            if (localPort != NaN) {
                blockchain.start(localPort)
            }
            else {
                console.log("Invalid args")
                process.exit();
            }
            break
        case 2:
            localPort = parseInt(args[0])
            remotePort = parseInt(args[1])
            if (remotePort != NaN) {
                return blockchain.connect(localPort, `https://dml-p2p-${remotePort}.localtunnel.me`)
            }

            if (localPort != NaN) {
                blockchain.connect(localPort, args[1])
            }

            else {
                console.log("Invalid args")
                process.exit();
            }
            break;
        default:
            process.exit()
            break;
    }
}

start()