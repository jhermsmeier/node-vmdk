var stream = require( 'readable-stream' )
var VMDK = require( '../vmdk' )

class ReadStream extends stream.Readable {

  constructor( options ) {

    options = Object.assign( {}, ReadStream.defaults, options )
    options.highWaterMark = 64 * 1024

    super( options )

    this.fd = options.fd
    this.path = options.path
    this.flags = options.flags
    this.mode = options.mode
    this.endPosition = options.end || Infinity
    this.autoClose = options.autoClose
    this.chunkSize = options.highWaterMark

    this.image = options.image || new VMDK.Image()

    this.position = options.start || 0
    this.bytesRead = 0

    this.opened = false
    this.closed = false
    this.destroyed = false

    this.on( 'end', () => {
      if( this.autoClose ) {
        this.close()
      }
    })

    this._onRead = ( error, bytesRead, buffer ) => {

      if( !error && bytesRead !== buffer.length ) {
        error = new Error( `Bytes read mismatch: ${bytesRead} != ${buffer.length}` )
      }

      if( error ) {
        if( this.autoClose ) {
          this.destroy()
        }
        this.emit( 'error', error )
        return
      }

      this.bytesRead += bytesRead
      this.position += buffer.length
      this.push( buffer )

    }

    this.open()

  }

  open() {

    if( this.image.fd != null ) {
      this.emit( 'open' )
      return
    }

    this.image.open( this.path, {}, ( error ) => {
      if( error ) {
        if( this.autoClose ) {
          this.destroy( error )
        } else {
          this.emit( 'error', error )
        }
      } else {
        this.opened = true
        // FIXME: This needs to be the largest allocated address in the image
        var info = this.image.usageInfo()
        this.endPosition = Math.min( this.endPosition, info.used )
        this.emit( 'open' )
      }
    })

  }

  _read( n ) {

    // Wait for file handle to be open
    if( !this.opened ) {
      this.once( 'open', () => this._read() )
      return
    }

    var toRead = this.endPosition - this.position
    if( toRead <= 0 ) {
      this.push( null )
      return
    }

    var length = Math.min( this.chunkSize, toRead )
    var buffer = Buffer.allocUnsafe( length )

    this.image.read( buffer, 0, length, this.position, this._onRead )

  }

  close( callback ) {

    if( this.closed || this.image.fd == null ) {
      if( this.image.fd == null ) {
        this.once( 'open', () => {
          this.close()
        })
      } else {
        process.nextTick(() => {
          this.emit( 'close' )
          callback && callback()
        })
      }
      return
    }

    this.closed = true
    this.opened = false

    this.image.close(( error ) => {
      error ?
        this.emit( 'error', error ) :
        this.emit( 'close' )
    })

  }

  _destroy( error, callback ) {
    this.close(( closeError ) => {
      callback( error || closeError )
    })
  }

}

ReadStream.defaults = {
  fd: null,
  path: null,
  flags: 'r',
  // mode: 0o666,
  autoClose: true,
  highWaterMark: 64 * 1024,
}


module.exports = ReadStream
