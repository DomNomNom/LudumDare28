var app = require('http').createServer(handler);
var io = require('socket.io').listen(app);
var fs = require('fs');
var util = require('util');

app.listen(9001);

var count = 0;
function readFile(res, fileName){
  fs.readFile(
    __dirname +'/'+ fileName,
    function (err, data) {
      if (err) {
        res.writeHead(500);
        return res.end('Error loading: ' + fileName);
      }

      res.writeHead(200);
      res.end(data);
    }
  );
}

function handler (req, res) {
  //console.log('a: ' + req);
  console.log('request for: ' + util.inspect(req.url));

  var url = req.url;
  if (url == '/') readFile(res, 'index.html');
}

io.sockets.on('connection', function (socket) {
  io.sockets.emit('count', {count: count});
  socket.on('increment', function (data) {
    count += 1;
    io.sockets.emit('count', {count: count});
    console.log('increment: ' + count);
  });
  socket.on('reset', function (data) {
    count = 0;
    io.sockets.emit('count', {count: count});
    console.log('reset: ' + count);
  });
});

console.log('running')
