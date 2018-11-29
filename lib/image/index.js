var VMDK = require( '../vmdk' )
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
    this.gtSectors = 0
    /** @type {Number} Number of Grain Directory entries */
    this.gdEntryCount = 0
    /** @type {Number} Length of a Grain Table in bytes */
    this.gtBytes = 0
    /** @type {Number} Grain size in bytes */
    this.grainBytes = 0

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
        info.grains.used++
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
    return Math.floor( x / this.gtSectors )
  }

  gte( x ) {
    // GTE = GT [ floor( ( x % 2**(9+G) ) / 2**(G) ) ]
    return Math.floor( ( x % this.gtSectors ) / this.extentHeader.grainSize )
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
          this.gtSectors = 2 ** ( Math.log2( this.gteCount ) + Math.log2( this.extentHeader.grainSize ) )
          this.gdEntryCount = this.extentHeader.capacity / this.gtSectors
          this.gtBytes = this.gteCount * VMDK.GDE_SIZE
          this.grainBytes = this.extentHeader.grainSize * VMDK.SECTOR_SIZE
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

      var eod = -1
      var ddf = null

      if( error == null ) {
        eod = Math.min( buffer.indexOf( 0x00 ), buffer.length )
        try {
          ddf = VMDK.DiskDescriptor.parse( buffer, 0 )
        } catch( e ) {
          return void callback.call( this, error, ddf )
        }
      }

      callback.call( this, error, ddf )

    })

  }

  readGrainDirectory( position, length, callback ) {

    var buffer = Buffer.alloc( length )
    var offset = 0

    fs.read( this.fd, buffer, offset, buffer.length, position, ( error, bytesRead, buffer ) => {
      if( error == null ) {
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

    var length = this.gtBytes * this.gdEntryCount
    var buffer = Buffer.alloc( length )
    var offset = 0

    // NOTE: Assuming the GT-space is contiguous, we can load
    // all GTs at once, and skip use of GDEs to identify
    // offsets into the GT (which should be the case according to the spec)
    var position = this.gd.readUInt32LE( 0 ) * VMDK.SECTOR_SIZE

    fs.read( this.fd, buffer, offset, buffer.length, position, ( error, bytesRead, buffer ) => {
      callback.call( this, error, buffer )
    })

  }

  open( filename, options, callback ) {

    if( typeof options === 'function' ) {
      callback = options
      options = null
    }

    options = Object.assign({}, Image.defaults, options)

    // TODO:
    //  - Update `uncleanShutdown` in extent header (?)
    //  - Handle VMDKs with extent children
    //  - Handle DDF-only VMDKs

    series([
      ( next ) => this._open( filename, options, next ),
      ( next ) => this.readExtentHeader( next ),
      ( next ) => {
        var position = this.extentHeader.descriptorOffset * VMDK.SECTOR_SIZE
        var length = this.extentHeader.descriptorSize * VMDK.SECTOR_SIZE
        this.readDiskDescriptor( position, length, ( error, ddf ) => {
          this.ddf = ddf
          next( error )
        })
      },
      // TODO: Read both GDs, and use the one defined by the extent header flags
      ( next ) => {
        var position = this.extentHeader.rgdOffset * VMDK.SECTOR_SIZE
        var length = this.gdEntryCount * VMDK.GDE_SIZE
        this.readGrainDirectory( position, length, ( error, buffer ) => {
          this.gd = error == null ? buffer : null
          next( error )
        })
      },
      ( next ) => {
        var position = ( this.extentHeader.rgdOffset * VMDK.SECTOR_SIZE ) + ( this.gdEntryCount * VMDK.GDE_SIZE )
        var length = this.gtBytes * this.gdEntryCount
        this.readGrainTables( position, length, ( error, buffer ) => {
          this.gt = error == null ? buffer : null
          next( error )
        })
      },
    ], ( error ) => {
      callback.call( this, error )
    })

  }

  read( buffer, offset, length, position, callback ) {

    var fromLBA = Math.floor( position / VMDK.SECTOR_SIZE )
    var fromGDE = this.gde( fromLBA )
    var fromGTE = this.gte( fromLBA )

    var toLBA = Math.ceil( ( position + length ) / VMDK.SECTOR_SIZE )
    var toGDE = this.gde( toLBA )
    var toGTE = this.gte( toLBA )

    if( fromGDE === toGDE && fromGTE === toGTE ) {
      // We're still within one grain -> simple intra-read
      var gteOffset = ( fromGDE * this.gtSize ) + fromGTE
      var grainSector = this.gt.readUInt32LE( gteOffset * VMDK.GTE_SIZE )
      // Offset into the grain = position - grainStart
      var startInGrain = ( fromLBA * VMDK.SECTOR_SIZE ) - position
      // var endInGrain = startInGrain + length
      var readPosition = ( grainSector * VMDK.SECTOR_SIZE ) + startInGrain
      // console.log( 'read:intra-grain', readPosition, '|', startInGrain, '-', endInGrain )
      fs.read( this.fd, buffer, offset, length, readPosition, ( error, bytesRead, buffer ) => {
        callback.call( this, error, bytesRead, buffer )
      })
    } else {
      // We have to read from multiple grains -> inter-read
      console.log( 'read:inter-grain' )
      process.nextTick(() => {
        callback.call( this, new Error( 'Not implemented' ) )
      })
    }

  }

  close( callback ) {

    // TODO:
    //  - Update `uncleanShutdown` in extent header (?)
    //  - Flush extent header back to disk
    //  - Flush GD & RGD back to disk

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
