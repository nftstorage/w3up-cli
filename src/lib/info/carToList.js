import { CarIndexer } from '@ipld/car/indexer'
import { CarReader } from '@ipld/car/reader'

/**
 * @async
 * @param {Buffer|Uint8Array} bytes
 * @returns {Promise<string>} A simple list of all CIDs in the car.
 */
export async function run(bytes) {
  const indexer = await CarIndexer.fromBytes(bytes)
  const reader = await CarReader.fromBytes(bytes)
  let output = 'CIDv1\t\t\t\t\t\t\t\tCIDv0\n'

  const roots = reader._header.roots // a little naughty but we need gory details

  output += 'ROOTS:\n'
  for (const root of roots) {
    output += root.toString() + '\tz' + root.toV0().toString()
  }

  output += '\n\nCIDS:\n'
  for await (const blockIndex of indexer) {
    if (roots.find((x) => x.toString() == blockIndex.cid.toString())) {
      continue
    }
    const block = await reader.get(blockIndex.cid)
    if (!block?.bytes) {
      throw 'no blocks'
    }

    const cidv1 = blockIndex.cid.toString()
    let cidv0 = 'N/A'
    try {
      cidv0 = 'z' + blockIndex.cid.toV0()
    } catch (err) {}

    output += `${cidv1}\t${cidv0}`
    output += '\n'
  }
  return output
}
