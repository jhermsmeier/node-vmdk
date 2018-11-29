var VMDK = require( './vmdk' )
var fs = require( 'fs' )

/**
 * @internal Run a series of asynchronous tasks
 * @param {Array<Function>} tasks
 * @param {Function} callback
 * @returns {undefined}
 */
function series( tasks, callback ) {

  var run = ( error ) => {
    var task = tasks.shift()
    error || task == null ?
      callback( error ) :
      task( run )
  }

  run()

}

class Image {

  constructor() {

    this.path = null
    this.fd = null
    this.flags = null
    this.mode = null

    /** @type {VMDK.SparseExtentHeader} Extent header */
    this.extentHeader = null

    /** @type {Number} Number of Grain Table entries */
    this.gteCount = 0
    /** @type {Number} Number of sectors covered by a Grain Table */
    this.gtCoverage = 0
    /** @type {Number} Number of Grain Directory entries */
    this.gdEntryCount = 0
    /** @type {Number} Length of a Grain Table in bytes */
    this.gtSize = 0

  }

  usageInfo() {

    var info = {
      size: 0,
      used: 0,
      free: 0,
      capacity: this.extentHeader.capacity * VMDK.SECTOR_SIZE,
      grains: { used: 0, zero: 0, free: 0 },
    }

    for( var offset = 0; offset < this.gt.length; offset += 4 ) {
      var grain = this.gt.readUInt32LE( offset )
      if( grain === 0 ) {
        info.grains.free++
      } else if( grain === 1 ) {
        info.grains.zero++
        info.grains.free++
      } else {
        info.grains.used++
      }
    }

    info.used = info.grains.used * ( this.extentHeader.grainSize * VMDK.SECTOR_SIZE )
    info.free = info.grains.free * ( this.extentHeader.grainSize * VMDK.SECTOR_SIZE )
    info.size = info.used + ( this.extentHeader.overhead * VMDK.SECTOR_SIZE )

    return info

  }

  gde( x ) {
    // GDE = GD [ floor( x / 2**(9+G) ) ]
    return Math.floor( x / this.gtCoverage )
  }

  gte( x ) {
    // GTE = GT [ floor( ( x % 2**(9+G) ) / 2**(G) ) ]
    return Math.floor( ( x % this.gtCoverage ) / this.extentHeader.grainSize )
  }

  _open( filename, options, callback ) {
    fs.open( filename, options.flags, options.mode, ( error, fd ) => {
      if( error == null ) {
        this.fd = fd
        this.path = filename
        this.flags = options.flags
        this.mode = options.mode
      }
      callback.call( this, error )
    })
  }

  readExtentHeader( callback ) {

    var buffer = Buffer.alloc( VMDK.SparseExtentHeader.SIZE )
    var offset = 0
    var position = 0

    fs.read( this.fd, buffer, offset, buffer.length, position, ( error, bytesRead, buffer ) => {
      if( error == null ) {
        try {
          this.extentHeader = VMDK.SparseExtentHeader.parse( buffer )
          this.gteCount = this.extentHeader.numGTEsPerGT || VMDK.GTE_COUNT
          this.gtCoverage = 2 ** ( Math.log2( this.gteCount ) + Math.log2( this.extentHeader.grainSize ) )
          this.gdEntryCount = this.extentHeader.capacity / this.gtCoverage
          this.gtSize = this.gteCount * VMDK.GDE_SIZE
        } catch( e ) {
          next( e )
        }
      }
      callback.call( this, error )
    })

  }

  readDiskDescriptor( position, length, callback ) {

    var buffer = Buffer.alloc( length )
    var offset = 0

    fs.read( this.fd, buffer, offset, buffer.length, position, ( error, bytesRead, buffer ) => {
      if( error == null ) {
        var eod = Math.min( buffer.indexOf( 0x00 ), buffer.length )
        // TODO: Parse DDF
        this.ddf = buffer.toString( 'utf8', 0, eod ).trim().split( /(?:\r?\n)+/g )
      }
      callback.call( this, error )
    })

  }

  readGrainDirectory( position, length, callback ) {

    var buffer = Buffer.alloc( length )
    var offset = 0

    fs.read( this.fd, buffer, offset, buffer.length, position, ( error, bytesRead, buffer ) => {
      if( error == null ) {
        this.gd = buffer
        // Detect non-contiguous GT-space
        var lastGtOffset = 0
        for( var offset = 0; offset < buffer.length; offset += 4 ) {
          var gtOffset = buffer.readUInt32LE( offset )
          if( offset !== 0 && ( gtOffset - lastGtOffset !== 4 ) ) {
            error = new Error( 'Non-contiguous Grain Table space not supported' )
            return void callback.call( this, error, buffer )
          }
          lastGtOffset = gtOffset
        }
      }
      callback.call( this, error, buffer )
    })

  }

  readGrainTables( position, length, callback ) {

    var length = this.gtSize * this.gdEntryCount
    var buffer = Buffer.alloc( length )
    var offset = 0

    // NOTE: Assuming the GT-space is contiguous, we can load
    // all GTs at once, and skip use of GDEs to identify
    // offsets into the GT (which should be the case according to the spec)
    var position = this.gd.readUInt32LE( 0 ) * VMDK.SECTOR_SIZE

    fs.read( this.fd, buffer, offset, buffer.length, position, ( error, bytesRead, buffer ) => {
      if( error == null ) {
        this.gt = buffer
      }
      callback.call( this, error, buffer )
    })

  }

  open( filename, options, callback ) {

    if( typeof options === 'function' ) {
      callback = options
      options = null
    }

    options = Object.assign({}, Image.defaults, options)

    series([
      ( next ) => this._open( filename, options, next ),
      ( next ) => this.readExtentHeader( next ),
      ( next ) => {
        var position = this.extentHeader.descriptorOffset * VMDK.SECTOR_SIZE
        var length = this.extentHeader.descriptorSize * VMDK.SECTOR_SIZE
        this.readDiskDescriptor( position, length, next )
      },
      ( next ) => {
        var position = this.extentHeader.rgdOffset * VMDK.SECTOR_SIZE
        var length = this.gdEntryCount * VMDK.GDE_SIZE
        this.readGrainDirectory( position, length, next )
      },
      ( next ) => {
        var position = ( this.extentHeader.rgdOffset * VMDK.SECTOR_SIZE ) + ( this.gdEntryCount * VMDK.GDE_SIZE )
        var length = this.gtSize * this.gdEntryCount
        this.readGrainTables( position, length, next )
      },
    ], ( error ) => {
      callback.call( this, error )
    })

  }

  close( callback ) {
    fs.close( this.fd, ( error ) => {
      callback.call( this, error )
    })
  }

}

Image.defaults = {
  flags: 'r',
  // mode: 0o666,
}

module.exports = Image
