var _ = require('underscore');
var openDB = require('./db');
var db;
process.on("config", function(config, callback) {
  openDB(config.mongo, function(_db) {
    db = _db;
    callback();
  });
});

function getValue(value, field) {
  var segments = field.split('.');
  for (var idx in segments) {
    var segment = segments[idx];
    value = value[segment];
  }
  return value;
}

function isQualified(qualifier, value) {
  if (!qualifier) {
    return true;
  }
  for (var key in qualifier) {
    var val = qualifier[key];
    // TODO: support other operation besides equals
    if (value !== val) {
      return false;
    }
  }
  return true;
}

var operations = {
  "count" : function(value, name, bucketNo, result, helper) {
    var _result = result[name];
    if (!_result) {
        result[name] = _result = [];
    }
    if (_result[bucketNo]) {
        _result[bucketNo] ++;
    }
    else {
        _result[bucketNo] = 1;
    }
  },
  "avg" : function(value, name, bucketNo, result, helper) {
    var _result = result[name];
    var _helper = helper[name];
    if (!_result) {
        result[name] = _result = [];
        helper[name] = [];
    }
    if (_result[bucketNo]) {
        var total = _result[bucketNo] * _helper[bucketNo];
        total += value;
        var count = ++ helper[name][bucketNo];
        _result[bucketNo] = total / count;
    }
    else {
         helper[name][bucketNo] = 1;
         _result[bucketNo] = value;
    }
  },
  "min" : function(value, name, bucketNo, result, helper) {
    var _result = result[name];
    if (!_result) {
        result[name] = _result = [];
    }
    if (_result[bucketNo]) {
        if (value < _result[bucketNo]) {
            _result[bucketNo] = value;
        }
    }
    else {
        _result[bucketNo] = 1;
    }
  },
  "max" : function(value, name, bucketNo, result, helper) {
    var _result = result[name];
    if (!_result) {
        result[name] = _result = [];
    }
    if (_result[bucketNo]) {
        if (value > _result[bucketNo]) {
            _result[bucketNo] = value;
        }
    }
    else {
        _result[bucketNo] = 1;
    }
  }
};

function getOperation(serie) {
    var op = serie.operation;
    if (!op) {
      return undefined;
    }
    return operations[op.toLowerCase()];
}

function calculate(measurement, bucketNo, result, helper, series) {
  for (var name in series) {
    var serie = series[name];
    var value = getValue(measurement, serie.field);
    var qualifier = serie.qualifier;
    if (!isQualified(qualifier, value)) {
      continue;
    }
    var operation = getOperation(serie);
    if (operation) {
      operation(value, name, bucketNo, result, helper);
    }
  }
}

function getBucketFunction(body) {
  var duration = body.end - body.start;
  var bucketLength = duration / body.count;
  return function(timestamp) {
    return Math.floor((timestamp - body.start) / bucketLength);
  }
}

function getMongoQualifier(body) {
  var qualifier = body.qualifier || {};
  qualifier.timestamp = {
    "$gte": body.start,
    "$lte": body.end
  };
  return qualifier;
}

function query(body, callback) {
  db.collection('measurements', function(error, collection) {
    if (error) {
      callback({
        "error": error
      });
      return;
    }
    var qualifier = getMongoQualifier(body);
    collection.find(qualifier, function(error, cursor) {
      if (error) {
        callback({
          "error": error
        });
        return;
      }
      var result = {};
      var helper = {};
      var getBucket = getBucketFunction(body);
      cursor.each(function(err, doc) {
        if (error) {
          result.error = error;
          callback(result);
          return;
        }
        if (!doc) {
          callback(result);
          return;
        }
        var bucketNo = getBucket(doc.timestamp);
        calculate(doc, bucketNo, result, helper, body.series);
      })
    });
  });
}
process.on("message", function(body, callback) {
  query(body, callback);
});