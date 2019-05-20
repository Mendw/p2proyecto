var blockchain = require('./blockchain')
var utils = require('./utils')
var args = process.argv.slice(2);

switch (args.length) {
    case 1:
        var port = parseInt(args[0])
        if (port != NaN) {
            blockchain.start(port)
        }
        else {
            console.log("Invalid args")
            process.exit();
        }
        break
    case 2:
        var localPort = parseInt(args[0])
        var remotePort = parseInt(args[1])

        if (localPort != NaN && remotePort != NaN) {
            blockchain.connect(localPort, 'localhost', remotePort)
        }
        else {
            console.log("Invalid args")
            process.exit();
        }
        break;
    case 3:
        var localPort = parseInt(args[0])
        var remotePort = parseInt(args[2])

        if (localPort != NaN && remotePort != NaN && utils.isIp(args[1])) {
            blockchain.connect(localPort, args[1], remotePort)
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