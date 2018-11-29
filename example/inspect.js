var argv = process.argv.slice( 2 )
var MBR = require( 'mbr' )
var VMDK = require( '..' )
var inspect = require( '../test/inspect' )

var image = new VMDK.Image()
var filename = argv.shift()

image.open( filename, ( error ) => {

  if( error ) {
    throw error
  }

  inspect.log( image )
  console.log( 'Usage', image.usageInfo() )

  image.close(( error ) => {
    if( error ) throw error
  })

})
