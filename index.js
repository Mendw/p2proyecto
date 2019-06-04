var blockchain = require('./blockchain')
var args = process.argv.slice(2);
var local = true;

if(!local) process.stdin.resume();
process.on('beforeExit', (code) => {
    console.log(`closing with code´${code}`)
    blockchain.close(local)
});
process.on('SIGINT', (code) => {
    blockchain.close(local)
    console.log(code)
    process.exit()
});
process.on('SIGTERM', code => {
    blockchain.close(local)
    console.log(code)
    process.exit()
});
process.on('uncaughtException', (exception) => {
    console.dir(exception)
    blockchain.close(local)
    process.exit()
});
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
                return blockchain.connect(localPort, local ? `http://localhost:${remotePort}` : `http://dml-p2p-${localPort}.localtunnel.me`, local)
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