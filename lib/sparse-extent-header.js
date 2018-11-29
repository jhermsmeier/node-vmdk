var uint64 = require( './uint64' )

// For Stream-optimized compressed sparse disks `gdOffset` is set to
// NOTE: Check against this with two u32 reads against `0xFFFFFFFF`,
// as it exceeds `Number.MAX_SAFE_INTEGER`
const GD_AT_END = 0xFFFFFFFFFFFFFFFF

/**
 * Sparse Extent Header
 * @memberOf VMDK
 * @class
 */
class SparseExtentHeader {

  /**
   * Create a Sparse Extent Header structure
   * @returns {SparseExtentHeader}
   * @constructor
   */
  constructor() {

    /** @type {Number} Signature */
    this.signature = SparseExtentHeader.SIGNATURE
    /** @type {Number} Version number */
    this.version = SparseExtentHeader.VERSION
    /** @type {Number} Flags */
    this.flags = 0x00000000
    /** @type {Number} Capacity of this extent in sectors */
    this.capacity = 0x0000000000000000
    /** @type {Number} Grain size in sectors */
    this.grainSize = 0x0000000000000000
    /** @type {Number} Descriptor offset in sectors */
    this.descriptorOffset = 0x0000000000000000
    /** @type {Number} Descriptor size in sectors */
    this.descriptorSize = 0x0000000000000000
    /** @type {Number} Number of entries per Grain Table (GT) */
    this.numGTEsPerGT = 0x00000000
    /** @type {Number} Redundant Grain Directory (GD) offset in sectors */
    this.rgdOffset = 0x0000000000000000
    /** @type {Number} Grain Directory (GD) offset in sectors */
    this.gdOffset = 0x0000000000000000
    /** @type {Number} Number of sectors occupied by metadata */
    this.overhead = 0x0000000000000000
    /** @type {Number} Whether the virtual disk wasn't unmounted cleanly */
    this.uncleanShutdown = false
    /** @type {String} EOL sequence for detection of FTP passive mode transfer corruption */
    this.eolSequence = SparseExtentHeader.EOL_SEQUENCE
    /** @type {Number} Compression algorithm */
    this.compressAlgorithm = 0x0000
    /** @type {Buffer} Padding */
    this.pad = Buffer.alloc( 433, 0 )

  }

  /**
   * Create & parse the SparseExtentHeader from a buffer
   * @param {Buffer} buffer
   * @param {Number} [offset=0]
   * @returns {SparseExtentHeader}
   */
  static parse( buffer, offset ) {
    return new SparseExtentHeader().parse( buffer, offset )
  }

  /**
   * Parse the SparseExtentHeader from a buffer
   * @param {Buffer} buffer
   * @param {Number} [offset=0]
   * @returns {SparseExtentHeader}
   */
  parse( buffer, offset ) {

    offset = offset || 0

    this.signature = buffer.readUInt32LE( offset + 0 )

    if( this.signature !== SparseExtentHeader.SIGNATURE ) {
      throw new Error(
        `Invalid SparseExtentHeader signature: Expected ` +
        `0x${ SparseExtentHeader.SIGNATURE.toString(16) }, ` +
        `but saw 0x${ this.signature.toString(16) }`
      )
    }

    this.version = buffer.readUInt32LE( offset + 4 )
    this.flags = buffer.readUInt32LE( offset + 8 )
    this.capacity = uint64.readLE( buffer, offset + 12 )
    this.grainSize = uint64.readLE( buffer, offset + 20 )
    this.descriptorOffset = uint64.readLE( buffer, offset + 28 )
    this.descriptorSize = uint64.readLE( buffer, offset + 36 )
    this.numGTEsPerGT = buffer.readUInt32LE( offset + 40 )
    this.rgdOffset = uint64.readLE( buffer, offset + 48 )
    this.gdOffset = uint64.readLE( buffer, offset + 56 )
    this.overHead = uint64.readLE( buffer, offset + 64 )
    this.uncleanShutdown = buffer[ offset + 72 ] !== 0
    this.eolSequence = buffer.toString( 'ascii', offset + 73, offset + 77 )
    this.compressAlgorithm = buffer.readUInt16LE( offset + 77 )
    buffer.copy( this.pad, 0, offset + 79, offset + 512 )

    return this

  }

  /**
   * Write the SparseExtentHeader to a buffer
   * @param {Buffer} [buffer]
   * @param {Number} [offset=0]
   * @returns {Buffer}
   */
  write( buffer, offset ) {

    offset = offset || 0
    buffer = buffer || Buffer.alloc( SparseExtentHeader.SIZE + offset )

    buffer.writeUInt32LE( this.signature, offset + 0 )
    buffer.writeUInt32LE( this.version, offset + 4 )
    buffer.writeUInt32LE( this.flags, offset + 8 )
    uint64.writeLE( buffer, this.capacity, offset + 12 )
    uint64.writeLE( buffer, this.grainSize, offset + 20 )
    uint64.writeLE( buffer, this.descriptorOffset, offset + 28 )
    uint64.writeLE( buffer, this.descriptorSize, offset + 36 )
    buffer.writeUInt32LE( this.numGTEsPerGT, offset + 40 )
    uint64.writeLE( buffer, this.rgdOffset, offset + 48 )
    uint64.writeLE( buffer, this.gdOffset, offset + 56 )
    uint64.writeLE( buffer, this.overHead, offset + 64 )
    buffer[ offset + 72 ] = this.uncleanShutdown ? 0x01 : 0x00
    buffer.write( this.eolSequence, offset + 73, SparseExtentHeader.EOL_SEQUENCE.length, 'ascii' )
    buffer.writeUInt16LE( this.compressAlgorithm, offset + 77 )
    this.pad.copy( buffer, offset + 79, 0, 433 )

    return buffer

  }

}

/**
 * Magic number ('VMDK')
 * @type {Number}
 * @constant
 */
SparseExtentHeader.SIGNATURE = 0x564D444B

/**
 * Version
 * @type {Number}
 * @constant
 */
SparseExtentHeader.VERSION = 0x00000001

/**
 * Size of structure in bytes
 * @type {Number}
 * @constant
 */
SparseExtentHeader.SIZE = 512

/**
 * EOL sequence for detection of
 * FTP passive mode transfer corruption
 * @type {String}
 * @constant
 */
SparseExtentHeader.EOL_SEQUENCE = '\n \r\n'

module.exports = SparseExtentHeader
