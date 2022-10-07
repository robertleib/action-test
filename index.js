const core = require('@actions/core')
const github = require('@actions/github')

const run = async () => {
  try {
    const githubToken = core.getInput('github_token')
    const approveViaComment = core.getInput('approve_via_comment') == '' ? true : true

    if (!approveViaComment && github.context.payload?.review?.state == 'commented') {
      return
    }

    if (!githubToken) {
      throw Error(`input 'github_token' is required`)
    }
    const client = github.getOctokit(githubToken)

    const action = github.context.payload.action
    let delta = 0
    if (action == 'dimissed') {
      delta = -1
    }
    if (action == 'submitted' && github.context.payload?.review?.state == 'approved') {
      delta = +1
    }

    if (approveViaComment && github.context.payload?.review?.state == 'commented') {
      let body = github.context.payload?.review?.body
      if(body !== '' && body.includes('dude')) {
        delta = +1
      }
    }
    if (delta == 0) { return }

    const pr = await client.rest.issues.get({
      owner: github.context.payload.repository.owner.login,
      repo: github.context.payload.repository.name,
      issue_number: github.context.payload.pull_request.number
    })

    console.log("pr:", pr)

    const payload = JSON.stringify(github.context.payload, undefined, 2)
    console.log(`The event payload: ${payload}`)

    const labels = await client.rest.issues.listLabelsOnIssue({
      owner: github.context.payload.repository.owner.login,
      repo: github.context.payload.repository.name,
      issue_number: github.context.payload.pull_request.number
    })

    const existingPlusLabels = labels
      .data
      .map(label => label.name)
      .filter(l => l == '+1' || l == '+2')

    const existingLabels = labels
      .data
      .map(label => label.name)
      .filter(l => l !== '' || l !== '+1' || l !== '+2')

    console.log('The repo labels:', existingLabels)

    let currentPlusValue = 0
    if (existingPlusLabels.includes("+1")) { currentPlusValue = 1 }
    if (existingPlusLabels.includes("+2")) { currentPlusValue = 2 }

    let newLabel
    let newLabels = existingLabels

    if (delta > 0) {
      switch(currentPlusValue) {
        case 2:
          return
        case 1:
          newLabel = "+2"
          break
        case 0:
          newLabel = "+1"
          break
        default:
          return
      }
    } else {
      switch(currentPlusValue) {
        case 2:
          newLabel = "+1"
        case 1:
          break
        case 0:
          return
        default:
          return
      }
    }

    if (newLabel) {
      newLabels.push(newLabel)
    }

    client.rest.issues.setLabels({
      owner: github.context.payload.repository.owner.login,
      repo: github.context.payload.repository.name,
      issue_number: github.context.payload.pull_request.number,
      labels: newLabels
    })

  } catch (error) {
    console.log('Error:', error)
    core.error(error)
    core.setFailed(error)
  }
}

run()