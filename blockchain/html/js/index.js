var socket

function cycle(element, timeout) {
    element.setAttribute('disabled', 'true')
    element.style.opacity = '0.5'
    element.style.transitionDuration = `${Math.floor(timeout / 2)}`
    setTimeout(() => {
        element.removeAttribute('disabled')
        element.style.transitionDuration = `100`
        element.style.opacity = '1'
    }, timeout);
}

function blockButtons() {
    Array.from(document.getElementsByClassName('button')).forEach(button => {
        cycle(button, 2500)
    })
}

function savePair(data, filename, type = 'application/octet-stream') {
    var file = new Blob([data], { type: type });
    if (window.navigator.msSaveOrOpenBlob)
        window.navigator.msSaveOrOpenBlob(file, filename);
    else {
        var a = document.createElement("a"),
            url = URL.createObjectURL(file);
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        setTimeout(function () {
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        }, 0);
    }
}

function registerNew() {
    let username = document.getElementById('username').value
    if (username) {
        pair = generateKeyPair()
        serialized = serialize(pair)
        savePair(`${serialized.public}:${serialized.secret}`, 'keepsafe.bin')
        socket.emit('login', {
            username: username,
            public: serialized.public,
            signature: sign(`[username:${username}] [public:${serialized.public}]`, pair.secret),
        })

        blockButtons()
    } else alert("Select a username first")
}

function submitLogin() {
    let username = document.getElementById("username").value
    let fileBox = document.getElementById("fileBox")

    var reader = new FileReader()

    let file = fileBox.files[0]
    if (!file) {
        return
    }
    reader.readAsText(file)
    reader.onloadend = event => {
        console.dir(event.target.result.split(":"))
    }

    blockButtons()
}

window.onload = () => {
    socket = io('/client');

    socket.on('files', data => {
        console.log(data)
    })

    socket.on('login-approved', () => {
    })

    socket.on('login-denied', () => {
    })
}
/*
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
})*/