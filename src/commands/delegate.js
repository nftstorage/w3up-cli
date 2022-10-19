import fs from 'fs'
import ora from 'ora'

import { getClient } from '../client.js'
import { hasSetupAccount } from '../validation.js'

/**
 * @typedef {{did?:`did:${string}`, profile?: string}} Delegate
 * @typedef {import('yargs').Arguments<Delegate>} DelegateArgs
 */

/**
 * @async
 * @param {DelegateArgs} argv
 * @returns {Promise<void>}
 */
const handler = async ({ did, profile }) => {
  const view = ora({ spinner: 'line' })
  const client = getClient(profile)

  if (!did) {
    view.fail('You must provide a did to delegate to.')
    return
  }

  const delegation = await client.makeDelegation({ to: did })
  fs.writeFileSync('delegation.car', delegation, 'binary')

  view.succeed('Wrote delegation to delegation.car')
}

/**
 * @type {import('yargs').CommandBuilder} yargs
 * @returns {import('yargs').Argv<{}>}
 */
const builder = (yargs) => yargs.check(hasSetupAccount)

export default {
  command: 'delegate <did>',
  describe: 'Delegate permissions to another DID',
  builder,
  handler,
}
