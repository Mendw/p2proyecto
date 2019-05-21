var blockchain = require('./blockchain')
var utils = require('./utils')
var args = process.argv.slice(2);


var local = true;

if (!local) {
    process.stdin.resume();

    process.on('beforeExit', (code) => {
        console.log(`closing with code´${code}`)
        blockchain.close()
    });
    process.on('SIGINT', () => {
        blockchain.close()
        process.exit()
    });
    process.on('uncaughtException', (exception) => {
        console.dir(exception)
        blockchain.close()
        process.exit()
    });
}

let localPort, remotePort
var start = () => {
    switch (args.length) {
        case 1:
            localPort = parseInt(args[0])
            if (localPort != NaN) {
                blockchain.start(localPort, local)
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
                return blockchain.connect(localPort, local ? `http://localhost:${remotePort}` : `http://dml-p2p-${port}.localtunnel.me`, local)
            }

            if (localPort != NaN) {
                blockchain.connect(localPort, args[1], local)
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