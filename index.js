var fs = require('fs');
var server = require("./server");
var argv = process.argv;

for (var idx = 2; idx < argv.length; idx++) {
  var arg = argv[idx];
  if (arg === "--profile") {
    require("v8-profiler");
    argv.splice(idx, 1);
  }
}

console.info("node version %s", process.version);
process.title = "server-tracker";

if (argv.length < 3) {
  server.start({});
}
else {
  fs.readFile(argv[2], "utf-8", function(err, data) {
    if (err) {
      throw err;
    }
    var options = JSON.parse(data);
    server.start(options);
  });
}
