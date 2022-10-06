const core = require('@actions/core')
const github = require('@actions/github')

const run = async () => {
  try {
    const githubToken = core.getInput('github_token')
    if (!githubToken) {
      throw Error(`input 'github_token' is required`)
    }
    const client = github.getOctokit(githubToken)

    const pr = await client.rest.issues.get({
      owner: github.context.payload.repository.owner.login,
      repo: github.context.payload.repository.name,
      issue_number: github.context.payload.pull_request.number
    })

    console.log("pr:", pr)

    const payload = JSON.stringify(github.context.payload, undefined, 2)
    console.log(`The event payload: ${payload}`)

    const existingLabels = client.rest.issues.listLabelsOnIssue({
      owner: github.context.payload.repository.owner.login,
      repo: github.context.payload.repository.name,
      issue_number: context.payload.pull_request.number
    })



    // const existingLabels = pr.data.labels.map(label => label.name).filter(l => l !== '')


    console.log('The repo labels:', existingLabels)

  } catch (error) {
    console.log('Error:', error)
    core.error(error)
    core.setFailed(error)
  }
}

run()