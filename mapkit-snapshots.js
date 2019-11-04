#!/usr/bin/env node

/*
 * Original source is found here.
 *   https://developer.apple.com/documentation/snapshots/generating_a_url_and_signature_to_create_a_maps_web_snapshot
 *
*/

const { readFileSync } = require("fs");
const { sign } = require("jwa")("ES256");  // https://www.npmjs.com/package/jwa
const opn = require('better-opn'); // https://www.npmjs.com/package/better-opn

/* Read your private key from the file system. (Never add your private key
 * in code or in source control. Always keep it secure.)
 */
 const privateKey = readFileSync("AuthKey_XXXXXXXXXX.p8");
 // Replace the team ID and key ID values with your actual values.
 const teamId = "XXXXXXXXXX";
 const keyId = "XXXXXXXXXX";

// Creates the signature string and returns the full Snapshot request URL including the signature.
function signIt(params) {
    const mapkitServer = `https://snapshot.apple-mapkit.com`
    const snapshotPath = `/api/v1/snapshot?${params}`;
    var completePath = `${snapshotPath}&teamId=${teamId}&keyId=${keyId}`;

    const signature = sign(completePath, privateKey);

    // Append the signature to the end of the request URL, and return.
    url = `${mapkitServer}${completePath}&signature=${signature}`

    // Optionally open the result in the default browser using `opn`
    // opn(url);
    console.log(url);

    return url;
}


// Call the signIt function with a simple map request.

/*
``` bash
node mapkit-snapshots.js > tmp/out.md
```
*/

var signedMapsWebSnapshotURL;

// See `readme.md` for live examples and example parameters

// Yosemite
signedMapsWebSnapshotURL = signIt("center=37.839622,-119.515182")

// Annotations to be displayed on the map, specified as an array of JSON Annotation objects.
annotations = [
  {"point":"32.732373,-117.197503", "color":"blue",  "glyphText":"A", "markerStyle":"large"},
  {"point":"32.715104,-117.174038", "color":"00ff00","glyphText":"9", "markerStyle":"balloon"},
  {"point":"32.699945,-117.169792", "color":"red",   "glyphText":"a", "markerStyle":"dot"}
];

// An array of overlays to be displayed on the map, specified as an array of JSON Overlay objects.
overlays = [
  {
    "points": ["32.732373,-117.197503", "32.715104,-117.174038", "32.699945,-117.169792"],
    "strokeColor": "ff0000", "lineWidth": 2, "lineDash": [10,5]
  }
];

// Each query parameter must be URL-encoded.
encodeAnnotations = encodeURIComponent(JSON.stringify(annotations));
encodeOverlays = encodeURIComponent(JSON.stringify(overlays));

// Annotations example
signedMapsWebSnapshotURL = signIt("center=San%20Diego,%20California&annotations=" + encodeAnnotations)

// Overlays example
signedMapsWebSnapshotURL = signIt("center=San%20Diego,%20California&overlays=" + encodeOverlays)

// Annotations & Overlays
signedMapsWebSnapshotURL = signIt("center=San%20Diego,%20California" +
  "&annotations=" + encodeAnnotations +
  "&overlays=" + encodeOverlays)
