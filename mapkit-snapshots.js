#!/usr/bin/env node

/*
 * Original source is found here.
 *   https://developer.apple.com/documentation/snapshots/generating_a_url_and_signature_to_create_a_maps_web_snapshot
 *
*/

const { readFileSync } = require("fs");
var fs = require('fs')
const { sign } = require("jwa")("ES256");  // https://www.npmjs.com/package/jwa
const opn = require('better-opn'); // https://www.npmjs.com/package/better-opn
var argv = require('minimist')(process.argv.slice(2))  // parse argument options
var concat = require('concat-stream')
var stdin
var usage = "Usage:\n  mapkit-snapshots.js <file.geojson> -c config.json # pass in privateKey, teamId, keyId"
var signThis;
var privateKey, teamId, keyId;


 if (argv.help || argv.h) {
  console.log(usage)
  process.exit()
}

// process `config.json`
if (argv.c) {
  var config;

  configJson = fs.createReadStream(argv.c)
  configJson.pipe(
    concat( function (buffer) {
      try {
          config = JSON.parse(buffer)
          console.log(config);
          /* Read your private key from the file system. (Never add your private key
           * in code or in source control. Always keep it secure.)
           */
          privateKey = readFileSync(config.privateKey);
           // Replace the team ID and key ID values with your actual values.
          teamId = config.teamId;
          keyId = config.keyId;
        } catch (e) {
          return console.error(e)
      }
    })
  );

}

if (argv._[0] && argv._[0] !== '-') {
  stdin = fs.createReadStream(argv._[0])
} else if (!process.stdin.isTTY || argv._[0] === '-') {
  stdin = process.stdin
} else {
  console.log(usage)
  process.exit(1)
}

// buffer all input
stdin.pipe(
  concat( function (buffer) {
    try {
        var geojson = JSON.parse(buffer)
      } catch (e) {
        return console.error(e)
    }

    // Example 1:  output each feature element
   geojson.features.forEach(element => {


     // https://developer.apple.com/documentation/snapshots/create_a_maps_web_snapshot#query-parameters
     if(element.geometry.type === "Point") {

       // Determine the center point of the static map in this order
       //   1.  The IMDF property, properties.display_point
       //   2.  properties.center
       //   3.  If Point, then use Point
       var lat, long;
       if ('display_point' in element.properties) {
         lat  = element.properties.display_point.coordinates[1];
         long = element.properties.display_point.coordinates[0];
       } else if ('center' in element.properties) {
         lat  = element.properties.center[1];
         long = element.properties.center[0];
       } else {
         lat  = element.geometry.coordinates[1];
         long = element.geometry.coordinates[0];
       }
       signThis = `center=${lat},${long}&`;
       console.log(signThis)

      // Handle cases where both `z` &`spn` are present.
      // Apple > When both z and spn are provided, spn takes precedence over z.
      if ('spn' in element.properties) {
        latDegrees = element.properties.spn[0];
        lonDegrees = element.properties.spn[1];
        signThis += `spn=${latDegrees},${lonDegrees}&`
        console.log(signThis)
      } else if ('z' in element.properties) {
        signThis += `z=${element.properties.z}&`
        console.log(signThis)
      }

      if ('size' in element.properties) {
        width = element.properties.size[0];
        height = element.properties.size[1];
        signThis += `size=${width}x${height}&`
        console.log(signThis)
      }

      if ('scale' in element.properties) {
        signThis += `scale=${element.properties.scale}&`
        console.log(signThis)
      }

      if ('t' in element.properties & element.properties.t != "") {
        signThis += `t=${element.properties.t}&`
        console.log(signThis)
      }

      if ('colorScheme' in element.properties & element.properties.colorScheme != "") {
        signThis += `colorScheme=${element.properties.colorScheme}&`
        console.log(signThis)
      }

      if ('poi' in element.properties) {
        signThis += `poi=${element.properties.poi}&`
        console.log(signThis)
      }

      if ('lang' in element.properties & element.properties.lang != "") {
        signThis += `lang=${element.properties.lang}&`
        console.log(signThis)
      }

      // if ('annotations' in element.properties) {
      //   signThis += `annotations=${element.properties.colorScheme}&`
      // Each query parameter must be URL-encoded.
      //   encodeAnnotations = encodeURIComponent(JSON.stringify(annotations));
      //   console.log(signThis)
      // }

      // if ('overlays' in element.properties) {
      //   signThis += `overlays=${element.properties.colorScheme}&`
      // Each query parameter must be URL-encoded.
      //   encodeOverlays = encodeURIComponent(JSON.stringify(overlays));
      //   console.log(signThis)
      // }

      if ('referer' in element.properties & element.properties.referer != "") {
        signThis += `referer=${element.properties.referer}&`
        console.log(signThis)
      }

      if ('expires' in element.properties) {
        signThis += `expires=${element.properties.expires}&`
        console.log(signThis)
      }

     }
   });

   signIt(signThis)
  })
)

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
    console.log()
    console.log(url);
    console.log()

    return url;
}
