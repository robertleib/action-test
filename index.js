const core = require('@actions/core')
const github = require('@actions/github')

const run = async () => {
  try {
    const payload = JSON.stringify(github.context.payload, undefined, 2)

    const githubToken = core.getInput('github_token')
    if (!githubToken) {
      throw Error(`input 'github_token' is required`)
    }

    const existingLabels = core
      .getInput('labels')
      .split('\n')
      .filter(l => l !== '')

    console.log(`The event payload: ${payload}`)
    console.log('The repo labels:', existingLabels)

  } catch (error) {
    console.log('Error:', error)
    core.error(error)
    core.setFailed(error)
  }
}

run()