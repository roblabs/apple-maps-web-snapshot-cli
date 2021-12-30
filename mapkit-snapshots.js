#!/usr/bin/env node

/**
 *  Adapted from:
 *   https://developer.apple.com/documentation/snapshots/generating_a_url_and_signature_to_create_a_maps_web_snapshot
*/

// MARK: - Requires, Vars
const { readFileSync } = require("fs");
var fs = require('fs')
const { sign } = require("jwa")("ES256");  // https://www.npmjs.com/package/jwa
const opn = require('better-opn'); // https://www.npmjs.com/package/better-opn
var argv = require('minimist')(process.argv.slice(2))  // parse argument options
var concat = require('concat-stream')
var stdin
var usage = "Usage:\n  mapkit-snapshots.js <file.geojson> -c config.json     # -c pass in privateKey, teamId, keyId\n  mapkit-snapshots.js <file.geojson> -c config.json -o  # -o opens in default browser"

// Setup an object to write out with some reasonable defaults
var snapshot = {};
snapshot.config = {}
snapshot.url = {"signature": "", "length": "", "text": ""}

// Big vars
var annotations = [], encodeAnnotations = [];
var overlays = [],    encodeOverlays = [];
var imgs = [],      encodeImgs = [];
var signThis;
var openUrl;
var privateKey, teamId, keyId;


// MARK: - Process CLI
if (argv.help || argv.h) {
  console.log(usage)
  process.exit()
}

// process `config.json`
// -c pass in privateKey, teamId, keyId
/* Read your private key from the file system. (Never add your private key
 * in code or in source control. Always keep it secure.)
 */
if (argv.c) {
  var config;

  configJson = fs.createReadStream(argv.c)
  configJson.pipe(
    concat( function (buffer) {
      try {
          config = JSON.parse(buffer)

          privateKey = readFileSync(config.privateKey);
          teamId = config.teamId;
          keyId = config.keyId;

          // update snapshot
          snapshot.config = config
        } catch (e) {
          return console.error(e)
      }
    })
  );

}

// -o opens in default browser
if (argv.o) {
  openUrl = true;
}

if (argv._[0] && argv._[0] !== '-') {
  stdin = fs.createReadStream(argv._[0])
} else if (!process.stdin.isTTY || argv._[0] === '-') {
  stdin = process.stdin
} else {
  console.log(usage)
  process.exit(1)
}

// MARK: - Process GeoJSON
  // Each query parameter must be URL-encoded.
stdin.pipe(
  concat( function (buffer) {
    try {
        var geojson = JSON.parse(buffer)
      } catch (e) {
        return console.error(e)
    }

    geojson.features.forEach(iterateMapKit);

    // images
    snapshot.imgs = {};
    if(Object.keys(imgs).length > 0) {
      snapshot.imgs = JSON.stringify(imgs);
      encodeImgs = encodeURIComponent(JSON.stringify(imgs));
      signThis += `imgs=${encodeImgs}&`
    }

    // MARK: annotations
    snapshot.annotationData = {};
    if(Object.keys(annotations).length > 0) {
        snapshot.annotationData.annotation = JSON.stringify(annotations);
        encodeAnnotations = encodeURIComponent(JSON.stringify(annotations));
        snapshot.annotationData.encodeURI = encodeAnnotations;
        snapshot.annotationData.annotationCount = annotations.length;
        signThis += `annotations=${encodeAnnotations}&`
    }

    // overlays
    snapshot.overlays = {};
    if(Object.keys(overlays).length > 0) {
      snapshot.overlays.overlay = JSON.stringify(overlays);
      encodeOverlays = encodeURIComponent(JSON.stringify(overlays));
      snapshot.overlays.encodeURI = encodeOverlays;
      signThis += `overlays=${encodeOverlays}&`
    }

    try {
      console.log()
      signIt(geojson.name, signThis)
    } catch (e) {
      console.error("signIt Error:  \n\t*** Please verify the settings in config.json\n")
      return console.error(e)
    } finally {
    }

  })
)

// MARK: - iterateMapKit()
// https://developer.apple.com/documentation/snapshots/create_a_maps_web_snapshot#query-parameters
function iterateMapKit(element, index, array) {

  //   Use the first `feature` for setting up parameters that are only used once (center, language, etc)
    // TODO: should be moved to FeatureCollection root
  if (index === 0) {
    // Determine the center point of the static map in this order
    //   1.  The IMDF property, properties.display_point
    //   2.  properties.center
    //   3.  If Point, then use Point
    var lat, long;
    if ("display_point" in element.properties) {
      point = coordinate2point(element.properties.display_point.coordinates)
    } else if ('center' in element.properties) {
      if (typeof(element.properties.center) === "string") {
        // The input property for `center` can be
        //   A geocoded address is a valid value for the `center` parameter
        //   "The string `auto` is also a valid value for the `center` parameter
        point = encodeURIComponent(element.properties.center)  /// TODO: review if we can set precision
      } else {
        //   [long, lat] array of floats, to make it easy to reuse the GeoJSON formatting for points
        point = coordinate2point(element.properties.center.coordinates)
      }
    } else if(element.geometry.type === "Point"){
      // the `center` parameter was not set, fall back to the geometry
      point = coordinate2point(element.geometry.coordinates)
    } else {
      console.error("error: ❌ No center `point` is defined.  Please set `properties.display_point` (IMDF style), or `properties.center`")
    }

    signThis = `center=${point}&`;
    snapshot.center = `${point}`;

    // Handle cases where both `z` &`spn` are present.
    // Apple > When both z and spn are provided, spn takes precedence over z.
    if ('spn' in element.properties) {
      latDegrees = element.properties.spn[0];
      lonDegrees = element.properties.spn[1];
      spn = `${latDegrees},${lonDegrees}`;
      signThis += `spn=${spn}&`;
      snapshot.spn = spn;
    } else if ('z' in element.properties) {

      if(element.properties.z < 3 || element.properties.z > 20) {
        element.properties.z = 12
        console.error("Out of bounds zoom level; setting to Default\nDefault: 12\nMinimum: 3\nMaximum: 20")
      }
      signThis += `z=${element.properties.z}&`;
      snapshot.z = element.properties.z;
    }

    if ('size' in element.properties) {
      width = element.properties.size[0];
      height = element.properties.size[1];
      size = `${width}x${height}`;
      signThis += `size=${size}&`;
      snapshot.size = size;
    }

    if ('scale' in element.properties) {
     signThis += `scale=${element.properties.scale}&`;
     snapshot.scale = element.properties.scale;
    }

    if ('t' in element.properties & element.properties.t != "") {
      signThis += `t=${element.properties.t}&`;
      snapshot.t = element.properties.t;

      if(element.properties.t === "standard" ||
         element.properties.t === "mutedStandard") {
           if ('colorScheme' in element.properties & element.properties.colorScheme != "") {
             signThis += `colorScheme=${element.properties.colorScheme}&`;
             snapshot.colorScheme = element.properties.colorScheme;
           }
        }
    }

    if ('poi' in element.properties) {
      signThis += `poi=${element.properties.poi}&`;
      snapshot.poi = element.properties.poi;
    }

    if ('lang' in element.properties & element.properties.lang != "") {
      signThis += `lang=${element.properties.lang}&`;
      snapshot.lang = element.properties.lang;
    }

    if ('referer' in element.properties & element.properties.referer != "") {
      signThis += `referer=${element.properties.referer}&`;
      snapshot.referer = element.properties.referer;
    }

    if ('expires' in element.properties) {
      signThis += `expires=${element.properties.expires}&`;
      snapshot.expires = element.properties.expires;
    }
   }

  // MARK: - annotations
    // creates: [Annotation]
  if (element.properties.annotation) {

    // creates: [Image], An array of custom images to annotate the map, specified as an array of JSON Image objects.
    if (element.properties.imgs) {
      imgs = element.properties.imgs
    }

    if (element.geometry.type === "MultiPoint") {
      for (var mp = 0; mp < element.geometry.coordinates.length; mp++) {

        annotation = element.properties.annotation[mp]
        lat  = element.geometry.coordinates[mp][1]
        long = element.geometry.coordinates[mp][0]
        point = `${lat},${long}`
        annotation.point = point

        // remove unused parameters to make the URL smaller
        if(annotation.offset === "0,0") {
          delete annotation.offset
        }

        if(annotation.glyphText === "") {
          delete annotation.glyphText
        }

        if(annotation.markerStyle === "dot") {
          delete annotation.glyphText
        }

        if(annotation.markerStyle === "img") {
          delete annotation.color
          delete annotation.glyphText
        } else {
          // remove unused that are related to `img`
          delete annotation.imgIdx
          delete annotation.offset
        }

        // set the annotation
        annotations.push(annotation)
        snapshot.annotationSource = element.geometry.type;
        annotation = {}
      }
    } // if MultiPoint

    // TODO:  if no points use `img`, then remove the `image` array
  } // if annotation

  // MARK: - overlays
    // creates: [Overlay]
  if (element.properties.hasOwnProperty("overlay")) {
    points = [];

    // Iterate over each Point in the LineString in the `overlay`
    for (let coord = 0; coord < element.properties.overlay.geometry.coordinates.length; coord++) {
      points.push(coordinate2point(element.properties.overlay.geometry.coordinates[coord]));
    }

    // An array of overlays to be displayed on the map, specified as an array of JSON Overlay objects.
    overlays.push({
        "points": points,
        "strokeColor": element.properties.overlay.style.strokeColor,
        "lineWidth":   element.properties.overlay.style.lineWidth,
        "lineDash":    element.properties.overlay.style.lineDash
    });
  } // If `overlay` exists
} // iterateMapKit

// MARK: - signIt(name, params)
// Creates the signature string and returns the full Snapshot request URL including the signature.
function signIt(name, params) {
    var mapkitServer = `https://snapshot.apple-mapkit.com`
    var snapshotPath = `/api/v1/snapshot?${params}`;  // snapshotPath is assumed to have the trailing '&'
    var completePath = `${snapshotPath}teamId=${teamId}&keyId=${keyId}`;
    const signature = sign(completePath, privateKey);

    // Append the signature to the end of the request URL, and return.
    url = `${mapkitServer}${completePath}&signature=${signature}`

    snapshot.url.text = url;
    snapshot.url.exec = "imagefrom " + name + " \"" + url + "\"";
    snapshot.url.signature = signature;
    snapshot.url.length = url.length;

    console.log(JSON.stringify(snapshot, null, 2));

    // Optionally open the result in the default browser using `opn`
    if(openUrl) {
      opn(snapshot.url.text);
    }

    return url;
}

// Return a GeoJSON Coordinate as a string in "lat,long" format
function coordinate2point(coordinate) {
  lat  = coordinate[1];
  long = coordinate[0];
  point = `${lat},${long}`;

  return point
}
