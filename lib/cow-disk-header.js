var uint64 = require( './uint64' )

/**
 * COW Disk Header
 * @memberOf VMDK
 * @class
 */
class COWDiskHeader {

  /**
   * Create a COW Disk Header structure
   * @returns {COWDiskHeader}
   * @constructor
   */
  constructor() {

    // NOTE: Only fields 'signature', 'version', 'flags',
    // 'numSectors', 'grainSize', 'gdOffset', 'numGDEntries',
    // 'freeSector', 'savedGeneration', and 'uncleanShutdown'
    // are used, the remaining fields are not used, and only
    // kept for backwards-compatibility with legacy virtual disk formats

    this.signature = COWDiskHeader.SIGNATURE
    this.version = COWDiskHeader.VERSION
    this.flags = COWDiskHeader.FLAGS
    this.numSectors = 0
    this.grainSize = 0
    this.gdOffset = 0
    this.numGDEntries = 0 // CEILING(numSectors, gtCoverage)
    this.freeSector = 0 // Init as `gdOffset + numGDSectors`

    // UNUSED
    // this.root = {
    //   cylinders: 0,
    //   heads: 0,
    //   sectors: 0
    // }

    // UNUSED
    // this.child = {
    //   parentFilename: ' '.repeat( COWDiskHeader.MAX_PARENT_FILELEN ),
    //   parentGeneration: 0,
    // }

    this.unused = Buffer.alloc( COWDiskHeader.MAX_PARENT_FILELEN + 4 )

    this.generation = 0
    this.name = ''
    this.description = ''
    this.savedGeneration = 0
    this.reserved = Buffer.alloc( 8 )
    this.uncleanShutDown = 0
    this.padding = Buffer.alloc( 396 )

  }

  /**
   * Create & parse the COWDiskHeader from a buffer
   * @param {Buffer} buffer
   * @param {Number} [offset=0]
   * @returns {COWDiskHeader}
   */
  static parse( buffer, offset ) {
    return new COWDiskHeader().parse( buffer, offset )
  }

  /**
   * Parse the COWDiskHeader from a buffer
   * @param {Buffer} buffer
   * @param {Number} [offset=0]
   * @returns {COWDiskHeader}
   */
  parse( buffer, offset ) {

    offset = offset || 0

    this.signature = buffer.readUInt32LE( offset + 0 )
    this.version = buffer.readUInt32LE( offset + 4 )
    this.flags = buffer.readUInt32LE( offset + 8 )
    this.numSectors = buffer.readUInt32LE( offset + 12 )
    this.grainSize = buffer.readUInt32LE( offset + 16 )
    this.gdOffset = buffer.readUInt32LE( offset + 20 )
    this.numGDEntries = buffer.readUInt32LE( offset + 24 )
    this.freeSector = buffer.readUInt32LE( offset + 28 )

    // UNUSED root / child ( 1024 + 4 bytes )
    buffer.copy( this.unused, 0, offset + 32, offset + 1060 )

    this.generation = buffer.readUInt32LE( offset + 1060 )
    this.name = buffer.toString( 'ascii', offset + 1064, offset + 1124 )
    this.description = buffer.toString( 'ascii', offset + 1124, offset + 1636 )
    this.savedGeneration = buffer.readUInt32LE( offset + 1636 )

    buffer.copy( this.reserved, 0, offset + 1640, offset + 1648 )

    this.uncleanShutDown = buffer.readUInt32LE( offset + 1648 )

    buffer.copy( this.padding, 0, offset + 1652, offset + COWDiskHeader.SIZE )

    return this

  }

  /**
   * Write the COWDiskHeader to a buffer
   * @param {Buffer} [buffer]
   * @param {Number} [offset=0]
   * @returns {Buffer}
   */
  write( buffer, offset ) {

    offset = offset || 0
    buffer = buffer || Buffer.alloc( COWDiskHeader.SIZE + offset )

    buffer.writeUInt32LE( this.signature, offset + 0 )
    buffer.writeUInt32LE( this.version, offset + 4 )
    buffer.writeUInt32LE( this.flags, offset + 8 )
    buffer.writeUInt32LE( this.numSectors, offset + 12 )
    buffer.writeUInt32LE( this.grainSize, offset + 16 )
    buffer.writeUInt32LE( this.gdOffset, offset + 20 )
    buffer.writeUInt32LE( this.numGDEntries, offset + 24 )
    buffer.writeUInt32LE( this.freeSector, offset + 28 )

    this.unused.copy( buffer, offset + 32 )

    buffer.writeUInt32LE( this.generation, offset + 1060 )
    buffer.fill( 0x00, offset + 1064, offset + 1636 )
    buffer.write( this.name, offset + 1064, COWDiskHeader.MAX_NAME_LEN, 'ascii' )
    buffer.write( this.description, offset + 1124, COWDiskHeader.MAX_DESC_LEN, 'ascii' )
    buffer.writeUInt32LE( this.savedGeneration, offset + 1636 )

    this.reserved.copy( buffer, offset + 1640 )

    buffer.writeUInt32LE( this.uncleanShutDown, offset + 1648 )

    this.padding.copy( buffer, offset + 1652 )

    return buffer

  }

}

/**
 * Magic number ('COWD')
 * @type {Number}
 * @constant
 */
COWDiskHeader.SIGNATURE = 0x44574F43

/**
 * Version
 * @type {Number}
 * @constant
 */
COWDiskHeader.VERSION = 0x00000001

/**
 * Default flags
 * @type {Number}
 * @constant
 */
COWDiskHeader.FLAGS = 0x00000003

/**
 * Size of structure in bytes
 * @type {Number}
 * @constant
 */
COWDiskHeader.SIZE = 2048

/**
 * Maximum name length in bytes
 * @type {Number}
 * @constant
 */
COWDiskHeader.MAX_NAME_LEN = 60

/**
 * Maximum description length in bytes
 * @type {Number}
 * @constant
 */
COWDiskHeader.MAX_DESC_LEN = 512

/**
 * Maximum parent filename length in bytes
 * @type {Number}
 * @constant
 */
COWDiskHeader.MAX_PARENT_FILELEN = 1024

module.exports = COWDiskHeader
