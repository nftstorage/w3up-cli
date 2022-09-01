import * as UnixFS from '@ipld/unixfs'
import fs from 'fs'
import path from 'path'

/**
 * @async
 * @param {object} options
 * @param {UnixFS.Writer} options.writer -
 * @param {any} options.filename -
 * @param {any} options.bytes -
 * @returns {Promise<{name:string, link:any}>}
 */
export async function fileToBlock({ writer, filename, bytes }) {
  // make file writer, write to it, and close it to get link/cid
  // @ts-ignore
  const file = UnixFS.createFileWriter(writer)
  file.write(bytes)
  const link = await file.close()

  return {
    name: filename,
    link,
  }
}

/**
 * @async
 * @param {object} options
 * @param {UnixFS.Writer} options.writer
 * @param {string} options.filePath
 * @returns {Promise<{name:string, link:any}>}
 */
export async function streamFileToBlock({ writer, filePath }) {
  const stream = fs.createReadStream(filePath, { encoding: 'binary' })
  // @ts-ignore
  const file = UnixFS.createFileWriter(writer)

  for await (const data of stream) {
    file.write(new Uint8Array(Buffer.from(data, 'binary')))
  }

  const link = await file.close()

  return {
    name: path.basename(filePath),
    link,
  }
}

// export async function generateTestFiles({
//   writer,
//   filename,
//   start = 0,
//   count = 0,
// }) {
//   let files = []
//   for (var i = start; i < start + count; i++) {
//     files.push(
//       await fileToBlock({
//         writer,
//         filename: filename + i,
//         bytes: new TextEncoder().encode('this is a test' + i),
//       })
//     )
//   }
//   return files
// }