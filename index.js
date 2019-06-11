const server = require('./code/server')
const args = process.argv.slice(2);

let events = ['beforeExit', 'SIGINT', 'SIGTERM', 'uncaughtException']
events.forEach(event => {
    process.on(event, code => {
        console.dir(code)
        server.close()
        if (event != 'beforeExit') process.exit()
    })
});

(() => {
    switch (args.length) {
        case 1:
            server.start(parseInt(args[0]))
            break
        case 2:
            server.start(parseInt(args[0]), parseInt(args[1]))
            break
        case 3:
            server.start(parseInt(args[0]), parseInt(args[1]), args[2])
            break
        default:
            break
    }
})()