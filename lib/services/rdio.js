"use strict";
var parse = require('url').parse;
var Q = require('q');

module.exports.id = "rdio";

if (!process.env.RDIO_API_KEY || !process.env.RDIO_API_SHARED) {
  console.warn("RDIO_API_KEY or RDIO_API_SHARED environment variables not found, deactivating Rdio.");
  return;
}

var rdio = require('rdio')({
  rdio_api_key: process.env.RDIO_API_KEY,
  rdio_api_shared: process.env.RDIO_API_SHARED,
});

module.exports.match = function(url, type) {
  var parsed = parse(url);
  return parsed.host.match(/rd\.io$/) || parsed.host.match(/rdio\.com$/);
};

module.exports.lookupId = function(id) {
  var deferred = Q.defer();
  rdio.api("", "", {
    method: 'getObjectFromShortCode',
    short_code: id,
  }, function(err, results) {
    if (err || !JSON.parse(results).result) {
      var error = new Error("Not Found");
      error.status = 404;
      deferred.reject(error);
      return;
    }
    var result = JSON.parse(results).result;
    var parsed = parse(result.shortUrl)
    var id = parsed.path.replace("/x/", "").replace("/", "");
    var type = result.album ? "track" : "album";
    deferred.resolve({
      service: "rdio",
      type: type,
      id: id,
      name: result.name,
      streamUrl: result.shortUrl,
      purchaseUrl: null,
      artwork: result.icon.replace("http:", "").replace("square-200", "square-250"),
      artist: {
        name: result.artist
      }
    });
  });
  return deferred.promise;
};

module.exports.parseUrl = function(url) {
  var deferred = Q.defer();
  var parsed = parse(url);

  var data;

  if (parsed.host == "rd.io") {
    data = {
      method: 'getObjectFromShortCode',
      short_code: parsed.path.replace("/x/", "").replace("/", ""),
    };
  } else if (parsed.host.match(/rdio\.com$/)) {
    data = {
      method: 'getObjectFromUrl',
      url: parsed.path,
    };
  } else {
    return;
  }

  rdio.api("", "", data, function(err, results) {
    var result = JSON.parse(results).result;
    var parsed = parse(result.shortUrl)
    var id = parsed.path.replace("/x/", "").replace("/", "");
    var type = result.album ? "track" : "album";
    deferred.resolve({
      service: "rdio",
      type: type,
      id: id,
      name: result.name,
      streamUrl: result.shortUrl,
      purchaseUrl: null,
      artwork: result.icon.replace("http:", "").replace("square-200", "square-250"),
      artist: {
        name: result.artist
      }
    });
  });
  return deferred.promise;
};

module.exports.search = function(data) {
  var deferred = Q.defer();
  var query, albumClean;
  var type = data.type;

  if (type == "album") {
    query = data.artist.name + " " + data.name;
    albumClean = data.name.match(/([^\(\[]+)/)[0];
  } else if (type == "track") {
    query = data.artist.name + " " + data.album.name + " " + data.name;
    albumClean = data.album.name.match(/([^\(\[]+)/)[0];
  }

  rdio.api("", "", {
    query: query,
    method: 'search',
    types: type,
  }, function(err, results) {
    var results = JSON.parse(results).result.results;

    var result = results.filter(function(result) {
      if (type == "album" && result.name.match(/([^\(\[]+)/)[0] == albumClean) {
        return result;
      } else if (type == "track" && result.album.match(/([^\(\[]+)/)[0] == albumClean) {
        return result;
      }
    }).shift();

    if (!result) {
      var matches = albumClean.match(/^[^\(\[]+/);
      if (matches[0] && matches[0] != albumClean) {
        var cleanedData = JSON.parse(JSON.stringify(data));
        if (type == "album") {
          cleanedData.name = matches[0].trim();
        } else if (type == "track") {
          cleanedData.album.name = matches[0].trim();
        }
        module.exports.search(cleanedData).then(deferred.resolve);
      } else {
        deferred.resolve({service: "rdio"});
      }
    } else {
      var parsed = parse(result.shortUrl)
      var id = parsed.path.replace("/x/", "").replace("/", "");
      deferred.resolve({
        service: "rdio",
        type: type,
        id: id,
        name: result.name,
        streamUrl: result.shortUrl,
        purchaseUrl: null,
        artwork: result.icon.replace("http:", "").replace("square-200", "square-250"),
        artist: {
          name: result.artist
        }
      });
    }
  });
  return deferred.promise;
};
