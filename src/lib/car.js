import path from 'path'
import fs from 'fs'
import 'web-streams-polyfill'
import * as UnixFS from '@ipld/unixfs'
// @ts-ignore
import * as CAR from '@ipld/car'

import { streamFileToBlock } from './file.js'
import { wrapFilesWithDir } from './dir.js'

// Internal unixfs read stream capacity that can hold around 32 blocks
const CAPACITY = UnixFS.BLOCK_SIZE_LIMIT * 1024
const MAX_CARS_AT_ONCE = 8

/**
 * @typedef {{stream: ReadableStreamReader<any>}} buildCarOutput
 * @typedef {{bytes: Uint8Array|null ,cid: object|null}} Block
 * @typedef {{name: string, link: any}} FileDesc
 */

/**
 * @param {string} pathName - The path to check if it's a directory
 * @returns {boolean}
 */
const isDirectory = (pathName) =>
  fs.existsSync(pathName) && fs.lstatSync(pathName).isDirectory()

/**
 * @async
 * @param {object} options
 * @param {UnixFS.Writer} options.writer - The UnixFS writer
 * @param {string} options.pathName - The current recursive pathname
 * @param {string} options.filename - The current filename
 * @returns {Promise<FileDesc>}
 */
async function walkDir({ writer, pathName, filename }) {
  const filePath = path.resolve(pathName, filename)

  if (isDirectory(filePath)) {
    /** @type {Array<FileDesc>} */
    let files = []
    const fileNames = (await fs.promises.readdir(filePath)).filter(
      (x) => !x.startsWith('.')
    )
    for (var name of fileNames) {
      files.push(
        await walkDir({
          writer,
          pathName: pathName + '/' + filename,
          filename: name,
        })
      )
    }
    return wrapFilesWithDir({
      writer,
      files,
      dirName: filename,
    })
  }

  return await streamFileToBlock({ writer, filePath })
}

/**
 * Create a readable block stream for a given path.
 * @async
 * @param {string} pathName - The path to create a car for.
 * @param {WritableStream} writable - The writable stream.
 * @returns {Promise<void>}
 */
async function createReadableBlockStreamWithWrappingDir(pathName, writable) {
  // Next we create a writer with filesystem like API for encoding files and
  // directories into IPLD blocks that will come out on `readable` end.
  const writer = UnixFS.createWriter({ writable })
  //   writer.settings.chunker.context.maxChunkSize = 1024 * 5

  // hold files to wrap with dir.
  let files = []
  pathName = path.normalize(pathName).replace(/\/$/, '')

  // discover if "root" of tree is directory or file.
  if (isDirectory(pathName)) {
    // if dir, walk down dir tree, and write out blocks
    const fileNames = (await fs.promises.readdir(pathName)).filter(
      (x) => !x.startsWith('.')
    )
    for (var name of fileNames) {
      files.push(
        await walkDir({
          writer,
          pathName: pathName,
          filename: name,
        })
      )
    }
  } else {
    // if file, just write to block and return to wrap.
    files = [await streamFileToBlock({ writer, filePath: pathName })]
  }

  await wrapFilesWithDir({ writer, files, dirName: pathName })
  writer.close()
}

/**
 * @param {number} carsize - The maximum size of a generated car file.
 * @returns {CAR.CarBufferWriter}
 */
function createCarWriter(carsize) {
  const buffer = new ArrayBuffer(carsize)
  return CAR.CarBufferWriter.createWriter(buffer, { roots: [] })
}

/**
 * @async
 * @param {string} pathName - The "root" of the path to generate car(s) for.
 * @param {number} carsize - The maximum size of generated car files.
 * @param {boolean} [failAtSplit=false] - Should this fail if it tries to split into multiple cars.
 * @returns {Promise<buildCarOutput>}
 */
export async function buildCar(pathName, carsize, failAtSplit = false) {
  // Create a redable & writable streams with internal queue
  const { readable, writable } = new TransformStream(
    {},
    UnixFS.withCapacity(CAPACITY)
  )
  const reader = readable.getReader()

  // Start filling the stream async
  createReadableBlockStreamWithWrappingDir(pathName, writable)

  // create the first buffer.
  let carWriter = createCarWriter(carsize)
  let carWriterStream = new TransformStream(
    {},
    {
      highWaterMark: MAX_CARS_AT_ONCE,
    }
  )
  let carStreamWriter = carWriterStream.writable.getWriter()

  async function readAll() {
    // Keep track of written cids, so that blocks are not duplicated across cars.
    let writtenCids = new Set()

    // track the last written block, so we know the root of the dag.
    /** @type Block */
    let root = { bytes: null, cid: null }
    async function* iterator() {
      while (true) {
        yield reader.read()
      }
      //       let next = await reader.read()
      //       while (!next?.done) {
      //         yield next
      //         next = await reader.read()
      //       }
    }

    await carStreamWriter.ready
    for await (const { value, done } of iterator()) {
      if (done) {
        break
      }
      if (writtenCids.has(value.cid.toString())) {
        continue
      }

      try {
        carWriter.write(value)
        writtenCids.add(value.cid.toString())
      } catch (err) {
        if (failAtSplit) {
          throw new Error('Content too large for car.')
        }
        const bytes = await carWriter.close({ resize: true })
        carStreamWriter.write({ bytes, roots: carWriter.roots })
        carWriter = createCarWriter(carsize)
        carWriter.write(value)
      }
      root = value
    }

    if (root) {
      carWriter.addRoot(root.cid, { resize: root.cid })
    }

    const bytes = await carWriter.close({ resize: true })
    carStreamWriter.write({ bytes, roots: carWriter.roots })
    carStreamWriter.close()
  }
  readAll()

  return {
    stream: carWriterStream.readable.getReader(),
  }
}
/**
 * @param {ReadableStreamDefaultReadResult<any>} block
 * @returns {Promise<void>}
 */
//   async function writeBlockToCar({ done, value }) {
//     await carStreamWriter.ready
//     // skip blocks if already in some car.
//     const skip = value && writtenCids.includes(value.cid.toString())
//
//     if (!done && !skip) {
//       try {
//         await carWriter.write(value)
//       } catch (err) {
//         if (failAtSplit) {
//           throw new Error('Content too large for car.')
//         }
//         const bytes = await carWriter.close({ resize: true })
//         carStreamWriter.write({ bytes, roots: carWriter.roots })
//         carWriter = createCarWriter(carsize)
//         await carWriter.write(value)
//       }
//
//       writtenCids.push(value.cid.toString())
//       root = value
//       return reader.read().then(writeBlockToCar)
//     } else {
//       if (root) {
//         carWriter.addRoot(root.cid, { resize: root.cid })
//       }
//       const bytes = await carWriter.close({ resize: true })
//       carStreamWriter.write({ bytes, roots: carWriter.roots })
//       return carStreamWriter.close()
//     }
//   }
//   reader.read().then(writeBlockToCar)
