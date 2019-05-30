var socket
var logs

var socketInfo
var recieved

var fileContainer
var loginResult

var mainDiv
var loginDiv

var loginfo

var openpath
var openfile

var canClick

const screens = {
    LOGIN: "LOGIN",
    MAIN: "MAIN"
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
        loginResult.innerText = "analyzing blockchain"
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
        loginResult.innerText = "trying to log in"
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

function parsePath() {
    if (!openpath) return

    let rv = ""
    openpath.forEach(folder => {
        rv += `/${folder}`
    })

    return rv
}

function openFile(name, ext) {
    if (ext) {
        openfile = `${name}.${ext}`
        console.log(openfile)
        socket.emit('get-file', {
            path: parsePath(),
            name: openfile,
        })
    } else {
        openpath.push(name)
        socket.emit('scan-directory', {
            path: parsePath(),
        })
    }

}

function clearFiles() {
    fileContainer.innerHTML = ""
}

function addFile(name, ext) {
    type = ext ? typeFromExtension(ext) : 'folder'

    let file = document.createElement("div")
    file.className = 'file'
    file.addEventListener('click', event => {
        if (canClick) {
            canClick = false
            clearFiles()
            openFile(name, ext)
            setTimeout(() => {
                canClick = true
            }, 1000);
        }
    })
    file.innerHTML = `<div>
        <img draggable="false" src='ico/blackwhite/${type}.png'>
        <img draggable="false" src='ico/color/${type}.png'>
    </div>
    <label>${name}</label>`

    fileContainer.appendChild(file)
}

window.addEventListener('beforeunload', event => {
    let timestamp = new Date().toISOString()

    socket.emit('logout', {
        username: loginfo.username,
        public: loginfo.public,
        timestamp: timestamp,
        signature: sign(`[${loginfo.username}][${loginfo.public}][${timestamp}]`, deserialize(loginfo.secret))
    })
})

window.onload = () => {
    socket = io('/client');

    logs = document.getElementById('logs-p')
    fileContainer = document.getElementById('files')
    loginResult = document.getElementById('login-result')
    loginDiv = document.getElementById('loginDiv')
    mainDiv = document.getElementById('mainDiv')
    loginfospan = document.getElementById('loginfo')

    canClick = true
    openpath = []
    openfile = ""

    socket.emit('scan-directory', {
        path: ""
    })

    socket.on('directory', data => {
        fileContainer.innerHTML = ""
        let pattern = /(.+)\.(.+)/
        data.filenames.forEach(name => {
            let result = name.match(pattern)
            if (result) {
                addFile(result[1], result[2])
            } else {
                addFile(name)
            }
        })
    })

    socket.on('file', data => {
        console.dir(data)
    })

    socket.on('connect', () => {

    })

    socket.on('disconnect', () => {

    })

    socket.on('register-approved', () => {
        loginResult.innerText = "Register Approved"
        loginResult.style.color = "green"

        savePair(`${loginfo.public}:${loginfo.secret}`, `${loginfo.username}.bin`)
    })

    socket.on('login-approved', () => {
        loginResult.innerText = "Login Approved"
        loginResult.style.color = "green"

        setTimeout(() => {
            switchScreen(screens.MAIN)
        }, 1000);
    })

    socket.on('register-denied', () => {
        loginResult.innerText = `register denied`
        loginResult.style.color = "red"
    })

    socket.on('login-denied', () => {
        loginResult.innerText = `login denied`
        loginResult.style.color = "red"
    })
}