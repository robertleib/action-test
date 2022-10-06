const core = require('@actions/core')
const github = require('@actions/github')

const run = async () => {
  try {
    const payload = JSON.stringify(github.context.payload, undefined, 2)
    console.log(`The event payload: ${payload}`)
  } catch (error) {
    console.log('Error:', error)
    core.error(error);
    core.setFailed(error);
  }
}

run()