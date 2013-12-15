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

// highscore list
var topNames  = ['dom'];
var topScore  = [10];
var topSize   = 10;

// returns whether we changed the highscores
function topInsert(name, score) {

  // remove ourselves from the list if we exitst
  var index = topNames.indexOf(name);
  if (index >= 0) {
    topNames.splice(index, 1);
    topScore.splice(index, 1);
  }

  // try insert us into the list
  if (score < topScore[topScore.length-1]) { // are we below the lowest?
    if (topScore.length == topSize) { return false; }
    else { // not full yet? add to the end.
      topNames.push(name);
      topScore.push(score);
      return true;
    }
  }

  // search for the index of our target location TODO: binary search
  for (index=topScore.length-1; index>=0; index-=1) {
    if (index==0 || topScore[index-1] > score) {
      break;
    }
  }

  // insert into list
  topNames.splice(index, 0, name );
  topScore.splice(index, 0, score);

  // limit the size
  while (topNames.length > topSize) {
    topNames.pop();
    topScore.pop();
  }

  return true; // we have changed the highscores
}


// http://stackoverflow.com/questions/1344500/efficient-way-to-insert-a-number-into-a-sorted-array-of-numbers
function locationOf(element, array, start, end) {
  start = start || 0;
  end = end || array.length;
  var pivot = parseInt(start + (end - start) / 2);
  if(end-start <= 1 || array[pivot] == element) return pivot;
  if(array[pivot] < element) {
    return locationOf(element, array, pivot, end);
  } else{
    return locationOf(element, array, start, pivot);
  }
}


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
    if (seconds<0.2) return; // ignore super-fast clicking
    prevTime = grabTime;
    var score = 0.3 * seconds * seconds;

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
    if (topInsert(data.name, total)) { // do highscoring
      io.sockets.emit('highscores', {
        topScore:topScore,
        topNames:topNames
      });
    }
  });

  // pass them the highscores at the start
  socket.emit('highscores', {
    topScore:topScore,
    topNames:topNames
  });


  // === counter app  ===
  socket.emit('count', {count: count});
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
