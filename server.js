var app = require('http').createServer(handler);
var io = require('socket.io').listen(app);
var fs = require('fs');
var util = require('util');

app.listen(9001);

// ====== Webserver hander ======

// sends a file to the user
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

function handler(req, res) {
  var url = req.url;
  if      (url == '/'             ) readFile(res, 'index.html'  );
  else if (url == '/connect4.css' ) readFile(res, 'connect4.css');
  else if (url == '/connect4.js'  ) readFile(res, 'connect4.js' );
  else if (url == '/favicon.ico'  ) { }
  else console.log('bad URL: ' + url);
}


// ====== socket hander ======


var count = 0;
var scores = {};
var prevTime = new Date();
var prevSaveTime = new Date(0); // epoch


io.sockets.on('connection', function (socket) {
  socket.emit('prevTime', {prevTime:prevTime});
  socket.on('grab', function (data) {
    if (!data.name) return;
    grabTime = new Date();
    // concurrency bugs go here
    var seconds = 0.001 * (
      grabTime.getTime() -
      prevTime.getTime()
    );
    prevTime = grabTime;
    var score = seconds * seconds;

    var total = score;
    if (data.name in scores) {
      total += scores[data.name];
    }
    scores[data.name] = total;

    socket.emit('score', {
      score: score,
      total: total,
      name:  data.name
    });
    io.sockets.emit('prevTime', {prevTime:prevTime});
  });

  // counter
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

console.log('running');
