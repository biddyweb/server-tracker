var jmxScrapper = require('./jmx-scrapper');
var MetricServer = require('./metric-server');
var QueryServer = require('./query-server');
var configuration = require('./config');
var Server = require('./express-server');
var openDB = require('./db');

function startServices(server, db, config) {
  var services = {
    metricServer : new MetricServer(config),
    queryServer : new QueryServer(db, config)
  };

  if (!config.properties.jmx) {
    config.properties.jmx = {};
  }

  services.jmx = jmxScrapper.start(db, config);

  // Routes
  server.post('/submit/events', function(req, res) {
    services.metricServer.postMetric(req, res);
  });
  server.post('/query', function(req, res) {
    services.queryServer.postQuery(req, res);
  });

  return services;
}

function stopServices(services) {
  jmxScrapper.stop(services);
}

function ServerTracker(options) {
  var listenPort = process.env.C9_PORT;

  if (!listenPort) {
    listenPort = options.listenPort ? options.listenPort : 3080;
  }

  this.server = new Server();
  this.server.listen(listenPort);
}

ServerTracker.prototype.stop = function() {
  this.server.stop();
  stopServices(this.services);
};

module.exports.start = function(options) {
  var server = new ServerTracker(options);
  var mongo = options.mongo ? options.mongo : {};

  openDB(mongo, function(db) {
    configuration(db, function(config) {
      server.services = startServices(server.server, db, config);

      config.on('change', function(config) {
        stopServices(server.services);

        server.services = startServices(server.server, db, config);
      });
    });
  });

  return server;
};
