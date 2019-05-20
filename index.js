var blockchain = require('./blockchain')
var utils = require('./utils')
var args = process.argv.slice(2);
const publicIP = require('public-ip')

    (async () => {
        var localIp = await publicIP.v4()
        switch (args.length) {
            case 1:
                var localPort = parseInt(args[0])
                if (localPort != NaN) {
                    blockchain.start(localIp, localPort)
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
                    blockchain.connect(localIp, localPort, localIp, remotePort)
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
                    blockchain.connect(localIp, localPort, args[1], remotePort)
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
    })();