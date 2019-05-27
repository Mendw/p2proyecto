var socket
var logs

var socketInfo
var recieved

var fileContainer

function updateState(data) {
    if (!data) {
        return
    }

    if (data.socketStatus != undefined && data.socketStatus != socketInfo.status) {
        socketInfo.status = data.socketStatus
        socketInfo.element.innerText = data.socketStatus ? 'connected' : 'disconnected'
        socketInfo.element.style.color = data.socketStatus ? 'green' : 'red'
    }

    if (data.recieved != undefined && data.recieved != 0) {
        recieved.count += data.recieved
        recieved.element.innerText = recieved.count
    }
}

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

    socketInfo = {
        element: document.getElementById('socket-status'),
        status: false,
    }

    recieved = {
        element: document.getElementById('packets-recieved'),
        count: 0
    }

    logs = document.getElementById('logs-p')
    fileContainer = document.getElementById('files')

    socket.on('files', data => {
        updateState({
            recieved: 1
        })
        let pattern = /(.+)\.(.+)/
        data.filenames.forEach(name => {
            let result = name.match(pattern)
            if (result) {
                fileContainer.innerHTML += `<div class='file'>
                <div>
                    <img src='ico/blackwhite/${result[2]}.png'>
                    <img src='ico/color/${result[2]}.png'>
                </div>
                <br>
                <label>${result[1]}</label>
            </div>`
            }
        })
    })

    socket.on('connect', () => {
        updateState({
            socketStatus: true
        })
    })

    socket.on('disconnect', () => {
        console.log("asd")
        updateState({
            socketStatus: false
        })
    })

    socket.on('login-approved', () => {
    })

    socket.on('login-denied', () => {
    })

    updateState({
        socketStatus: socket.connected,
        recieved: 0
    })
}