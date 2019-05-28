var socket
var logs

var socketInfo
var recieved

var fileContainer
var loginResult

var mainDiv, loginDiv

var loginfo
var loginfospan

const screens = {
    LOGIN: "LOGIN",
    MAIN: "MAIN"
}

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

        loginfo = {
            public: serialized.public,
            secret: serialized.secret,
            username: username
        }

        let timestamp = new Date().toISOString()
        socket.emit('register', {
            username: username,
            public: serialized.public,
            timestamp: timestamp,
            signature: sign(`[${username}][${serialized.public}][${timestamp}]`, pair.secret),
        })
        loginResult.innerText = "Processing"
        loginResult.style.color = "grey"

        blockButtons()
    } else alert("Select a username first")
}

function submitLogin() {
    let username = document.getElementById("username").value
    let fileBox = document.getElementById("fileBox")

    var reader = new FileReader()

    let file = fileBox.files[0]
    if (!file || !username) {
        return
    }
    reader.readAsText(file)
    reader.onloadend = event => {
        let [public, secret] = event.target.result.split(":")
        loginfo = {
            public: public,
            secret: secret,
            username: username
        }

        let timestamp = new Date().toISOString()
        secret = deserialize(secret)


        socket.emit('login', {
            username: username,
            public: public,
            timestamp: timestamp,
            signature: sign(`[${username}][${public}][${timestamp}]`, secret),
        })
        loginResult.innerText = "Processing"
        loginResult.style.color = "grey"
    }

    blockButtons()
}

function switchScreen(screen) {
    switch (screen) {
        case screens.LOGIN:
            loginDiv.style.display = 'flex'
            mainDiv.style.display = 'none'
            break;
        case screens.MAIN:
            mainDiv.style.display = 'flex'
            loginDiv.style.display = 'none'

            loginfospan.innerHTML = `username: ${loginfo.username}<br>
            public: ${loginfo.public.substring(0, 10)}`

            break;
    }
}

function typeFromExtension(extension) {
    switch (extension) {
        case 'mp3':
            return 'audio'
        case 'mp4':
            return 'video'
        case 'txt':
            return 'text'
        case 'jpg':
        case 'jpeg':
        case 'png':
            return 'image'
        default:
            return undefined
    }
}

function addFile(name, type) {
    fileContainer.innerHTML += `<div class='file'>
    <div>
        <img draggable="false" src='ico/blackwhite/${type}.png'>
        <img draggable="false" src='ico/color/${type}.png'>
    </div>
    <label>${name}</label>
</div>`
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
    loginResult = document.getElementById('login-result')
    loginDiv = document.getElementById('loginDiv')
    mainDiv = document.getElementById('mainDiv')
    loginfospan = document.getElementById('loginfo')

    socket.on('files', data => {
        updateState({
            recieved: 1
        })
        fileContainer.innerHTML = ""
        let pattern = /(.+)\.(.+)/
        data.filenames.forEach(name => {
            let result = name.match(pattern)
            if (result) {
                let name = result[1]
                let type = typeFromExtension(result[2])
                if (type) {
                    addFile(name, type)
                }
            } else {
                addFile(name, 'folder')
            }
        })
    })

    socket.on('connect', () => {
        updateState({
            socketStatus: true
        })
    })

    socket.on('disconnect', () => {
        updateState({
            socketStatus: false
        })
    })

    socket.on('register-approved', () => {
        loginResult.innerText = "Approved"
        loginResult.style.color = "green"

        savePair(`${loginfo.public}:${loginfo.secret}`, `${loginfo.username}.bin`)

        setTimeout(() => {
            switchScreen(screens.MAIN)
        }, 1000);
    })

    socket.on('login-approved', () => {
        loginResult.innerText = "Approved"
        loginResult.style.color = "green"

        setTimeout(() => {
            switchScreen(screens.MAIN)
        }, 1000);
    })

    socket.on('register-denied', () => {
        loginResult.innerText = "Denied"
        loginResult.style.color = "red"
    })

    socket.on('login-denied', () => {
        loginResult.innerText = "Denied"
        loginResult.style.color = "red"
    })

    updateState({
        socketStatus: socket.connected,
        recieved: 0
    })
}