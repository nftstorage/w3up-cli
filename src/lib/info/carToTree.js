import { decode } from './common.js'
import { CarIndexer } from '@ipld/car/indexer'
import { CarReader } from '@ipld/car/reader'
// @ts-ignore
import archy from 'archy'

// @ts-ignore
/** @typedef {import('multiformats/cid').CID} CID */
/** @typedef {{cid:CID, links: Array<any>}} Block */
/** @typedef {{label:string, nodes:Array<TreeNode>}} TreeNode */

/**
 * @async
 * @param {Buffer|Uint8Array} bytes
 * @returns {Promise<string>} the DOT format output of the DAG in the car.
 */
export async function run (bytes) {
  const indexer = await CarIndexer.fromBytes(bytes)
  const reader = await CarReader.fromBytes(bytes)
  /** @type Array<CID> */
  const roots = reader._header.roots // a little naughty but we need gory details

  /** @type TreeNode */
  const output = {
    label: 'roots',
    nodes: []
  }

  /** @type Array<Block> */
  const contentRoots = []
  /** @type Map<string, Block> */
  const blockMap = new Map()

  for await (const blockIndex of indexer) {
    const block = await reader.get(blockIndex.cid)
    if (!block?.bytes) {
      throw new Error('no blocks')
    }

    /** @type {{Links?:Array<any>, entries?:Array<any>}} */
    const content = decode(blockIndex.cid, block.bytes)

    const isRoot = roots.some((x) => x.toString() === blockIndex.cid.toString())
    const links = content.Links || content?.entries || []

    blockMap.set(blockIndex.cid.toString(), {
      // @ts-ignore
      cid: blockIndex.cid.toString(),
      links
    })

    if (isRoot) {
      contentRoots.push({
        // @ts-ignore
        cid: blockIndex.cid.toString(),
        links
      })
    }
  }

  for (const root of contentRoots) {
    // @ts-ignore
    output.nodes.push(walkTree(root.cid, '', blockMap))
  }

  return archy(output)
}

/**
 * @param {CID} cid
 * @param {string} name
 * @param {Map<CID, Block>} blockMap
 * @return {TreeNode}
 */
function walkTree (cid, name, blockMap) {
  const block = blockMap.get(cid)

  const label = name.length > 0 ? name : cid

  if (!block) {
    return { label: label + 'not found', nodes: [] }
  }

  return {
    // @ts-ignore
    label,
    nodes: block.links
      .map((x) =>
        walkTree(x.cid.toString(), x?.name || x?.Name || '', blockMap)
      )
      .filter((x) => x)
  }
}
