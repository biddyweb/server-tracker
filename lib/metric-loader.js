var hostname = require('os').hostname();
var _ = require('underscore');
var openDB = require('./db');
var pending = [];
var db;

process.on("config", function(config) {
  openDB(config.mongo, function(_db) {
    db = _db;
  });
});

function mergeProperties(source, target) {
  _.each(source, function(value, key) {
    if (!target[key]) {
      target[key] = value;
    }
  });
}

function normalizeEvents(event, events, normalized) {
  if (!events) {
    return;
  }
  var eventCounter = 0;
  var measurementCounter = 0;
  if (!_.isArray(events)) {
    events = [events];
  }
  _.each(events, function(event) {
    eventCounter++;
    var eventType = event.type;
    var measurements = event.measurements;

    if (!measurements) {
        measurements = event.metrics;
    }

    delete event.metrics;
    delete event.measurements;
    delete event.type;

    if (measurements) {
      _.each(measurements, function(_measurements, type) {
        if (!_.isArray(_measurements)) {
          _measurements = [_measurements];
        }
        _.each(_measurements, function(measurement) {
          measurementCounter++;
          if (eventType) {
            measurement.eventType = eventType;
          }
          mergeProperties(event, measurement);
          measurement.type = type;
          normalized.push(measurement);
        });
      });
    }
    event.type = "event";
    if (eventType) {
      event.eventType = eventType;
    }
    normalized.push(event);
  });
  event.eventCount = eventCounter;
  event.measurementCount = measurementCounter;
}

function normalizeLogs(event, logs, normalized) {
  if (!logs) {
    return;
  }
  var counter = 0;
  if (!_.isArray(logs)) {
    logs = [logs];
  }
  _.each(logs, function(log) {
    counter++;
    log.type = "log-record";
    normalized.push(log);
  });
  event.logCount = counter;
}

function postMeasurement(receiveTimestamp, body, remoteAddress) {
  var timestamp = Date.now();
  var submitTimestamp = body.timestamp;
  var events = body.events;
  var logs = body.logs;
  delete body.logs;
  delete body.events;
  delete body.timestamp;
  var normalized = [];
  var event = {
    "timestamp": timestamp,
    "hostname" : hostname
  };
  normalizeEvents(event, events, normalized);
  normalizeLogs(event, logs, normalized);
  _.each(normalized, function(measurement) {
    measurement.remoteAddress = remoteAddress;
    measurement.receiveTimestamp = receiveTimestamp;
    measurement.processTimestamp = timestamp;
    if (submitTimestamp) {
      measurement.submitTimestamp = submitTimestamp;
    }
    mergeProperties(body, measurement);
  });
  db.collection('measurements', function(error, collection) {
    if (error) {
      throw error;
    }
    _.each(pending, function(event) {
      normalized.push(event);
    });
    pending = [];
    collection.insert(normalized, function(error) {
      if (error) {
        throw error;
      }
      event.duration = Date.now() - timestamp;
      event.type = "measurement-loader";
      event.eventType = "server-tracker";
      pending.push(event);
    });
  });
  event.processingTime = Date.now() - timestamp;
}
process.on("message", function(messages) {
  _.each(messages, function(message){
      if (message.type) {
        pending.push(message);
        return;
      }
      var body = message.body;
      var remoteAddress = message.remoteAddress;
      var timestamp = message.timestamp;
      postMeasurement(timestamp, body, remoteAddress);
  });
});