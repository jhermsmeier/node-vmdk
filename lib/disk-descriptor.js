var VMDK = require( './vmdk' )

class DiskDescriptor {

  constructor() {
    this.map = new Map()
    this.extents = []
  }

  static parse( buffer, offset ) {
    return new DiskDescriptor().parse( buffer, offset )
  }

  get version() {
    return +this.map.get( 'version' )
  }

  get cid() {
    return parseInt( this.map.get( 'cid' ), 16 )
  }

  get parentCID() {
    return parseInt( this.map.get( 'parentcid' ), 16 )
  }

  get createType() {
    return this.map.get( 'createtype' )
  }

  get( key ) {
    return this.map.get( key.toLowerCase() )
  }

  set( key, value ) {
    return this.map.set( key.toLowerCase(), value )
  }

  parse( buffer, offset ) {

    this.map = new Map()
    this.extents = []

    var eod = Math.min( buffer.indexOf( 0x00, offset ), buffer.length )
    var lines = buffer.toString( 'utf8', offset, eod ).trim().split( /(?:\r?\n)+/g )
    var line = ''

    var commentPattern = /^#/
    var kvPattern = /^([^=]+)\s*\=\s*("?)([^\2]+?)\2$/i
    var extentPattern = /^(RW|RDONLY|NOACCESS)\s+(\d+)\s+(FLAT|SPARSE|ZERO|VMFS|VMFSSPARSE|VMFSRDM|VMFSRAW)\s+"([^"]+)"/i

    for( var i = 0; i < lines.length; i++ ) {
      line = lines[i].trim()
      if( commentPattern.test( line ) ) {
        continue
      } else if( extentPattern.test( line ) ) {
        var [ _, access, size, type, filename ] = line.match( extentPattern )
        this.extents.push({
          access: access.toUpperCase(),
          type: type.toUpperCase(),
          size: +size,
          filename
        })
      } else if( kvPattern.test( line ) ) {
        var [ _, key, q, value ] = line.match( kvPattern )
        this.map.set( key.toLowerCase(), value )
      }
    }

    return this

  }

  write( buffer, offset ) {

    offset = offset || 0
    buffer = buffer || Buffer.alloc( length )

    throw new Error( 'Not implemented' )

    return buffer

  }

  toString() {

    throw new Error( 'Not implemented' )

    return ''

  }

}

module.exports = DiskDescriptor
