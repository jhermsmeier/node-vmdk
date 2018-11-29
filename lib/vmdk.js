var VMDK = module.exports

/**
 * Sector (or block) size of VMDK images
 * @type {Number}
 * @constant
 */
VMDK.SECTOR_SIZE = 512

/**
 * Size of a Grain Directory Entry (GDE) in bytes
 * @type {Number}
 * @constant
 */
VMDK.GDE_SIZE = 4

/**
 * Size of a Grain Table Entry (GTE) in bytes
 * @type {Number}
 * @constant
 */
VMDK.GTE_SIZE = 4

/**
 * Number of Grain Table (GT) entries
 * @type {Number}
 * @constant
 */
VMDK.GTE_COUNT = 512

/**
 * Content ID type
 * @enum {Number}
 */
VMDK.CID = {
  NOPARENT: 0x0,
}

/**
 * Disk `createType`
 * @enum {String}
 */
VMDK.CREATE_TYPE = {
  FULL_DEVICE: 'fullDevice',
  MONOLITHIC_FLAT: 'monolithicFlat',
  MONOLITHIC_SPARSE: 'monolithicSparse',
  PARTITIONED_DEVICE: 'partitionedDevice',
  STREAM_OPTIMIZED: 'streamOptimized',
  TWO_GB_MAX_EXTENT_FLAT: 'twoGbMaxExtentFlat',
  TWO_GB_MAX_EXTENT_SPARSE: 'twoGbMaxExtentSparse',
  VMFS: 'vmfs',
  VMFS_PASSTHROUGH_RAW_DEVICE_MAP: 'vmfsPassthroughRawDeviceMap',
  VMFS_RAW: 'vmfsRaw',
  VMFS_RAW_DEVICE_MAP: 'vmfsRawDeviceMap',
  VMFS_SPARSE: 'vmfsSparse',
}

/**
 * Disk Database `adapterType`
 * @enum {String}
 */
VMDK.ADAPTER_TYPE = {
  IDE: 'ide',
  BUS_LOGIC: 'buslogic',
  LSI_LOGIC: 'lsilogic',
  LEGACY_ESX: 'legacyESX',
}

/**
 * Extent access type
 * @enum {String}
 */
VMDK.EXTENT_ACCESS = {
  RW: 'RW',
  RO: 'RDONLY',
  NA: 'NOACCESS',
}

/**
 * Extent type
 * @enum {String}
 */
VMDK.EXTENT_TYPE = {
  FLAT: 'FLAT',
  SPARSE: 'SPARSE',
  ZERO: 'ZERO',
  VMFS: 'VMFS',
  VMFS_SPARSE: 'VMFSSPARSE',
  VMFS_RDM: 'VMFSRDM',
  VMFS_RAW: 'VMFSRAW',
}

/**
 * Compression type
 * @enum {Number}
 */
VMDK.COMPRESSION = {
  NONE: 0x0000,
  DEFLATE: 0x0001,
}

/**
 * Grain marker type
 * @enum {Number}
 */
VMDK.MARKER = {
  EOS: 0,
  GT: 1,
  GD: 2,
  FOOTER: 3,
}

// TODO: ESX COW Disk enums (COW = Copy-on-Write)
VMDK.COWDISK = {
  MAX_PARENT_FILELEN: 1024,
  MAX_NAME_LEN: 60,
  MAX_DESC_LEN: 512,
}

VMDK.SparseExtentHeader = require( './sparse-extent-header' )
VMDK.COWDiskHeader = require( './cow-disk-header' )
VMDK.Image = require( './image' )
