import Inquirer from 'inquirer'
import ora from 'ora'

import { settings } from '../client.js'

/**
 * @async
 * @returns {Promise<void>}
 */
const exe = async () => {
  const view = ora('reset')
  view.stopAndPersist({
    text: `This will delete your settings, are you sure?
  You will lose access to anything created with your previous key/did.
  If you want to keep the previous settings, use export-settings first.
`,
  })

  const { reset } = await Inquirer.prompt({
    name: 'reset',
    type: 'confirm',
    default: false,
  })

  if (reset) {
    settings.clear()
    view.succeed('Settings cleared.')
  } else {
    view.info('exiting')
  }
}

export default {
  command: 'reset-settings',
  describe: 'Delete all local settings',
  builder: {},
  handler: exe,
  exampleOut: `Settings cleared.`,
  exampleIn: '$0 reset-settings',
}