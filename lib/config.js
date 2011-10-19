var _ = require('underscore');
var events = require('events');
var openDB = require('./db');
var fs = require('fs');
module.exports.bootstrap = function(callback) {
  var configFile = process.env.SERVER_TRACKEN_CONFIG ? process.env.SERVER_TRACKEN_CONFIG : process.env.HOME + "/.server-tracker.json";
  if (process.env.SERVER_TRACKEN_CONFIG) {
    configFile = process.env.SERVER_TRACKEN_CONFIG;
  }
  else {
    configFile = process.env.HOME + "/.server-tracker.json"
  }
  fs.readFile(configFile, "utf-8", function(err, data) {
    if (err) {
      throw err;
    }
    var options = JSON.parse(data);
    callback(options);
  });
}
/**
 * Write a set of options to the database
 */
module.exports.save = function(options, _callback) {
  openDB(options.mongo, function(db) {
    var callback = function(options) {
      db.close(function() {
        if (callback) {
          _callback(options);
        }
      });
    };
    db.collection('config', function(error, collection) {
      collection.insert({
        "timestamp": Date.now(),
        "options": JSON.stringify(options)
      }, function(err, doc) {
        if (err) {
          throw err;
        }
        callback(doc);
      })
    });
  });
};
module.exports.load = function(options, _callback) {
  openDB(options.mongo, function(db) {
    var callback = function(options) {
      db.close(function() {
        if (callback) {
          _callback(options);
        }
      });
    };
    db.collection('config', function(error, collection) {
      if (error) {
        throw error;
      }
      collection.ensureIndex([
        ['all'],
        ['_id', 1],
        ['timstamp', 1]
      ], function(err) {
        if (err) {
          throw err;
        }
      });
      collection.find({}, {
        "sort": [
          ["timestamp", "descending"]
        ]
      }, function(err, cursor) {
        if (err) {
          throw err;
        }
        cursor.nextObject(function(err, properties) {
          if (err) {
            throw err;
          }
          if (!properties) {
            callback(options);
            return;
          }
          if (_.isString(properties.options)) {
              properties.options = JSON.parse(properties.options);
          }
          if (!properties.options.mongo) {
            properties.options.mongo = options.mongo;
          }
          callback(properties.options);
        });
      });
    });
  });
};