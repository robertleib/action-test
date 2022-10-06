const core = require('@actions/core')
const github = require('@actions/github')

const run = async () => {
  try {
    const githubToken = core.getInput('github_token')
    if (!githubToken) {
      throw Error(`input 'github_token' is required`)
    }
    const client = new github.GitHub(githubToken)

    const pr = await client.issues.get({
      owner: github.context.payload.repository.owner.login,
      repo: github.context.payload.repository.name,
      issue_number: context.payload.pull_request.number
    })

    const payload = JSON.stringify(github.context.payload, undefined, 2)
    console.log(`The event payload: ${payload}`)



    const existingLabels = pr.data.labels.map(label => label.name).filter(l => l !== '')


    console.log('The repo labels:', existingLabels)

  } catch (error) {
    console.log('Error:', error)
    core.error(error)
    core.setFailed(error)
  }
}

run()