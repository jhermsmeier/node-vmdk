var argv = process.argv.slice( 2 )
var VMDK = require( '..' )
var inspect = require( '../test/inspect' )

var filename = argv.shift()
var readStream = new VMDK.Image.createReadStream( filename )

var bytesRead = 0

readStream.on( 'open', () => {
  inspect.log( readStream.image )
}).on( 'data', ( chunk ) => {
  bytesRead += chunk.length
}).on( 'end', () => {
  console.log( 'END', 'bytesRead', bytesRead )
})
