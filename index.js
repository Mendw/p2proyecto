var app = require('express')()
var http = require('http').createServer(app)
var io  = require('socket.io')(http)

app.get('/w', function(req, res){
    res.sendFile(__dirname + '/html/index.html')
})

io.on('connection', function(socket){
    console.log('New connection')
})

http.listen(3000, function(){
    console.log("server started @ 3000") 
})