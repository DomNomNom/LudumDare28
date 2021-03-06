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
  else if (url == '/favicon.ico'  ) { }
  else console.log('bad URL: ' + url);
}


var lastSave = new Date(0);
// I should use a DB for this, but it's not that critical
function backupScores() {
  var now = new Date();
  if (now.getTime()-lastSave.getTime() < 1000*60*60) {
    return; // don't backup all the time
  }

  lastSave = now;
  fs.writeFile(
    "backups/scores"+lastSave.getTime()+".json",
    JSON.stringify(scores),
    'utf8',
    function (err) {
        if(err) {
            console.log("Backup error: " + err);
        } else {
            console.log("Backup successful!");
        }
    });;
}

// ====== socket hander ======


var count = 0;
var scores = { 'dom' : 10 }; // TODO: load from backup
var prevTime = new Date();
var prevSaveTime = new Date(0); // epoch

// highscore list
var topNames  = ['dom'];
var topScore  = [10];
var topSize   = 20;

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

    // do highscoring
    if (topInsert(data.name, total)) {
      io.sockets.emit('highscores', {
        topScore:topScore,
        topNames:topNames
      });
    }

    backupScores();
  });

  // pass them the highscores at the start
  socket.emit('highscores', {
    topScore:topScore,
    topNames:topNames
  });


  // === old counter app  ===
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
