var fs = require('fs');
var main = require('./lib/main');
var server;

process.on('uncaughtException', function(err) {
  console.log(err.stack);
});

process.on('SIGINT', function() {
    console.log('Shutting down...');
    server.stop();
    process.exit(1);
});

function start(options) {
  if (server) {
    throw new Error("already running");
  }

    server = main.start(options);
}

function stop() {
  if (!server) {
    throw new Error("not urnning");
  }

    server.stop();
    server = null;
}

var argv = process.argv;

for (var idx = 2; idx < argv.length; idx++) {
  var arg = argv[idx];
  if (arg === "--profile") {
    require("v8-profiler");
    argv.splice(idx, 1);
  }
}

process.title = "server-tracker";

var configFile = argv.length > 2 ? argv[2] : process.env.HOME + "/.server-tracker.json";

fs.readFile(configFile, "utf-8", function(err, data) {
  if (err) {
    throw err;
  }
  var options = JSON.parse(data);

  start(options);
});
