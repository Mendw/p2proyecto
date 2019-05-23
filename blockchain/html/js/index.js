let cycle = (element, timeout) => {
    element.attr('disabled', 'true')
    setTimeout(() => {
        element.removeAttr('disabled')
    }, timeout);
}

$(function () {
    var socket = io('/client');
    socket.on('files', data => {
        console.log(data)
    })

    var pair = generateKeyPair()

    $('form').submit(e => {
        e.preventDefault()
        let username = $('#username').val()
        let password = $('#password').val()

        if (username && password) {
            let data = {
                username: username,
                public: serialize(pair.public).public,
                signature: sign(`[username|>${username}]`, pair.secret)
            }
            console.log(data)
            socket.emit('login', data)

            let submit = $('#submit')
            cycle(submit, 2000)
        } else {
            console.log("Invalid")
        }
        return false;
    })
})