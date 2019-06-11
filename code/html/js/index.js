var socket

var socketInfo
var recieved

var fileContainer
var loginResult

var mainDiv
var loginDiv

var loginfo

var openpath
var openfile

var quill

var canClick

//var backButton = document.createElement('div')
//backButton.className = 'file'
//backButton.addEventListener('click', event => {
//    clearFiles()
//    if (openpath) openpath.pop()
//    openFile(null, 'folder')
//})
//
//backButton.innerHTML = `<div>
//        <img draggable="false" src='ico/blackwhite/back-folder.png'>
//        <img draggable="false" src='ico/color/back-folder.png'>
//    </div>
//    <label>..</label>`
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

function getAuth() {
    if (!loginfo
        || !loginfo.username
        || !loginfo.public
        || !loginfo.secret) {
        return null
    }


    let timestamp = new Date().toISOString()
    return {
        username: loginfo.username,
        public: loginfo.public,
        timestamp: timestamp,
        signature: sign(`${loginfo.username}${loginfo.public}${timestamp}`, loginfo.secret)
    }
}

function registerNew() {
    let username = document.getElementById('username').value
    if (username) {
        pair = generateKeyPair()
        serialized = serialize(pair)

        loginfo = {
            public: serialized.public,
            secret: pair.secret,
            username: username
        }
        socket.emit('register', getAuth())
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
            secret: deserialize(secret),
            username: username
        }

        socket.emit('login', getAuth())
        loginResult.innerText = "trying to log in"
        loginResult.style.color = "grey"
    }

    blockButtons()
}

function sendMessage() {
    text = document.getElementById('chat-area').value.trim()
    if (text && text != '') {
        socket.emit('message', {
            message: text,
            auth: getAuth()
        })
    }
}

function switchScreen(screen) {
    switch (screen) {
        case screens.LOGIN:
            loginDiv.style.display = 'flex'
            mainDiv.style.display = 'none'
            document.getElementById('back-button').style.visibility = 'hidden'
            break;
        case screens.MAIN:
            mainDiv.style.display = 'flex'
            loginDiv.style.display = 'none'
            document.getElementById('back-button').style.visibility = 'visible'
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
    if (!openpath) return ''

    let rv = ''
    openpath.forEach(folder => {
        rv += `/${folder}`
    })

    return rv
}

function openFile(name, type) {
    let url, media, source
    openfile = name
    switch (type) {
        case 'folder':
            if (name) openpath.push(name)
            socket.emit('scan-directory', {
                path: parsePath(),
                auth: getAuth()
            })
            return
        case 'audio':
            url = new URL(window.location + `/${type}`)
            url.search = new URLSearchParams({
                path: parsePath(),
                filename: name,
            })

            media = document.createElement('audio')
            media.controls = true

            source = document.createElement('source')
            source.src = url

            media.appendChild(source)
            fileContainer.appendChild(media)
            media.autoplay = true;
            break
        case 'video':
            url = new URL(window.location + `/${type}`)
            url.search = new URLSearchParams({
                path: parsePath(),
                filename: name,
            })

            media = document.createElement('video')
            media.controls = true

            source = document.createElement('source')
            source.src = url

            media.appendChild(source)
            fileContainer.appendChild(media)
            media.autoplay = true;

            media.addEventListener('canplay', () => {
                media.width = fileContainer.offsetWidth
                media.height = fileContainer.offsetHeight
            })

            break
        case 'image':
            url = new URL(window.location + `/${type}`)
            url.search = new URLSearchParams({
                path: parsePath(),
                filename: name,
            })

            media = document.createElement('img')
            media.src = url

            media.width = fileContainer.offsetWidth
            media.height = fileContainer.offsetHeight

            fileContainer.appendChild(media)
            break
        case 'text':
            let editor = document.createElement('div')
            editor.setAttribute('id', 'editor')
            editor.style.width = fileContainer.offsetWidth + "px"
            editor.style.height = fileContainer.offsetHeight + "px";

            (async () => {
                await fetch('/text', {
                    method: "POST",
                    body: JSON.stringify({
                        filename: name,
                        path: parsePath(),
                        //auth: getAuth()
                    }),
                    headers: {
                        'Content-Type': 'application/json'
                    }
                }).then(res => res.text()).then(text => {
                    let parragraph = document.createElement('p')
                    parragraph.innerText = text
                    editor.appendChild(parragraph)

                    fileContainer.appendChild(editor)

                    quill = new Quill('#editor', {
                        theme: 'snow'
                    })

                    document.getElementById('save-button').style.visibility = 'visible'

                    let editSocket = io('/edit')

                    editSocket.on('text-change', data => {
                        delta.insert()
                            quill.updateContents(delta)
                    })

                    quill.on('text-change', (delta, oldDelta, source) => {
                        if (source == "user")
                            socket.emit('delta', {
                                delta: delta,
                                auth: getAuth()
                            })
                    })
                }).catch(err => console.error(err))
            })()
        default:
    }
}

function clearFiles() {
    fileContainer.innerHTML = ""
}

function addFile(name, type) {
    let file = document.createElement("div")
    file.className = 'file'
    file.addEventListener('click', event => {
        if (canClick) {
            canClick = false
            clearFiles()
            openFile(name, type)
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

function colorFromPublic(public) {
    return `#${sjcl.codec.hex.fromBits(sjcl.codec.base64.toBits(public)).substring(0, 6)}`
}

function addMessage(data) {
    let message = document.createElement('div')
    message.className = 'message'
    message.innerHTML = `${data.auth ? `
    <p style='padding: 10px; word-break: break-word;'>
    <span style="color:${colorFromPublic(data.auth.public)}">
        ${data.auth.username}
    </span>${data.message}</p>` : `<div style='color: #333; padding: 10px; overflow-wrap: break-word;'>
        ${data.message}
    </div>`}`

    let messages = document.getElementById('chat-messages')
    messages.appendChild(message)

    messages.scrollTop = messages.scrollHeight
}

window.addEventListener('beforeunload', event => {
    let auth = getAuth()
    if (auth) socket.emit('logout', auth)
})

function clearRooms() {

}

function setupSocket(socket) {
    socket.on('directory', data => {
        fileContainer.innerHTML = ""
        let pattern = /(.+)\.(.+)/
        data.forEach(pair => {
            if (pair.type == "folder") {
                addFile(pair.name, 'folder')
            } else {
                let result = pair.name.match(pattern)
                if (result) {
                    addFile(pair.name, typeFromExtension(result[2]))
                } else {
                    throw new Error('No wtf')
                }
            }
        })
    })

    socket.on('rooms', data => {
        clearRooms()
        data.forEach(room => {
            addRoom(room)
        })
    })

    socket.on('welcome', data => {
        addMessage(data)
        console.dir(socket)
    })

    socket.on('message', data => {
        addMessage(data)
    })

    socket.on('register-approved', () => {
        loginResult.innerText = "Register Approved"
        loginResult.style.color = "green"

        serialized = serialize({
            secret: loginfo.secret,
        })

        savePair(`${loginfo.public}:${serialized.secret}`, `${loginfo.username}.bin`)
    })

    socket.on('login-approved', () => {
        loginResult.innerText = "Login Approved"
        loginResult.style.color = "green"

        socket.emit('scan-directory', {
            path: '',
            auth: getAuth()
        })

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

window.onload = () => {
    socket = io('/local');

    fileContainer = document.getElementById('files')
    loginResult = document.getElementById('login-result')
    loginDiv = document.getElementById('loginDiv')
    mainDiv = document.getElementById('mainDiv')
    loginfospan = document.getElementById('loginfo')

    canClick = true
    openpath = []
    openfile = ""

    setupSocket(socket)


}