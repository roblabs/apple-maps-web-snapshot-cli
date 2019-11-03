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

    return url;
}


// Call the signIt function with a simple map request.

// Decorate with Markdown.
/* Required modules.
``` bash
node mapkit-snapshots.js > tmp/out.md
```
*/

var signedMapsWebSnapshotURL;

// Yosemite
signedMapsWebSnapshotURL = signIt("center=37.839622,-119.515182")

// Optionally open the result in the default browser using `opn`
// opn(signedMapsWebSnapshotURL);

console.log(signedMapsWebSnapshotURL);
