import fs from 'fs'
/**
 * Turns a number (representing a byte size) into a readable format.
 *
 * @param {number} size - The size in bytes
 * @returns {string} A humanized version of the number.
 */
const kb = 1024
const mb = Math.pow(kb, 2)
const gb = Math.pow(kb, 3)

/**
 * @param {number} size - The size to humanize in bytes.
 * @returns A string representing the "humanized" size.
 */
export function humanizeBytes(size) {
  if (size < kb / 2) {
    return size.toFixed(2) + 'B'
  } else if (size < mb / 2) {
    return (size / kb / 2).toPrecision(2) + 'KB'
  } else if (size < gb / 2) {
    return (size / mb).toFixed(2) + 'MB'
  }

  return (size / gb).toFixed(2) + 'GB'
}

/**
 * @param {string} pathName - The path to check if it's a directory
 * @returns {boolean}
 */
export const isDirectory = (pathName) =>
  fs.existsSync(pathName) && fs.lstatSync(pathName).isDirectory()
