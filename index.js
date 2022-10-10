const core = require('@actions/core')
const github = require('@actions/github')

const run = async () => {
  try {
    const githubToken = core.getInput('github_token')
    const approveViaComment = core.getInput('approve_via_comment') == '' ? false : true

    if (!approveViaComment && github.context.payload?.review?.state == 'commented') {
      return
    }

    if (!githubToken) {
      throw Error(`input 'github_token' is required`)
    }

    const client = github.getOctokit(githubToken)
    const sender = github.context.payload.sender.login
    const owner = github.context.payload.repository.owner.login
    const repo = github.context.payload.repository.name
    const issue_number = github.context.payload.pull_request.number

    const baseParams = {
      owner,
      repo,
      issue_number
    }
    console.log("Pr from context", github.context.payload.pull_request)
    assignPullRequestIfNoAssignees({ client, baseParams })

    const delta = findReviewCountDelta({ approveViaComment })
    if (delta == 0) { return }

    const prReviews = await client.request(`GET /repos/${owner}/${repo}/pulls/${issue_number}/reviews`, {
      owner,
      repo,
      pull_number: issue_number
    })

    existingApprovalCount = prReviews
      .data
      .flatMap((review, i, {length}) => {
        if (length - 1 !== i) {
          return [{state: review.state, user: review.user.login }]
        } else {
          return []
        }
      })
      .filter(r => r.state == 'APPROVED' && r.user != sender)
      .length

    const labels = await client.rest.issues.listLabelsOnIssue(baseParams)

    const existingLabels = labels
      .data
      .map(label => label.name)
      .filter(l => l !== '' && l !== '+1' && l !== '+2')

    let newLabel
    let newLabels = existingLabels

    if (delta > 0) {
      switch(existingApprovalCount) {
        case existingApprovalCount > 1:
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
      switch(existingApprovalCount) {
        case existingApprovalCount > 2:
          return
        case 2:
          newLabel = "+1"
          break
        case 1:
          break
        case existingApprovalCount < 1:
          return
        default:
          return
      }
    }

    if (newLabel) {
      newLabels.push(newLabel)
    }

    await client.rest.issues.setLabels({
      ...baseParams,
      labels: newLabels
    })

  } catch (error) {
    console.log('Error:', error)
    core.error(error)
    core.setFailed(error)
  }
}

const assignPullRequestIfNoAssignees = async ({
  client, baseParams
}) => {
  const pr = await client.rest.issues.get(baseParams)
  const assignees = pr.data.assignees
  const author = pr.data.user
  console.log("assignPullRequestIfNoAssignees", "author:", author.login, "assignees:", assignees )
  if (!assignees || assignees.length === 0) {
    await client.request(`POST /repos/${baseParams.owner}/${baseParams.repo}/issues/${baseParams.issue_number}/assignees`, {
      ...baseParams,
      assignees: [author.login]
    })
  }
}

const findReviewCountDelta = ({ approveViaComment = false }) => {
  const action = github.context.payload.action

  let delta = 0
  if (action == 'dismissed') {
    delta = -1
  }
  if (action == 'submitted' && github.context.payload?.review?.state == 'approved') {
    delta = +1
  }

  if (approveViaComment && github.context.payload?.review?.state == 'commented') {
    let body = github.context.payload?.review?.body || ''

    if(body.includes("👍")) {
      delta = +1
    } else if (body.includes("👎")) {
      delta = -1
    }
  }

  return delta
}

run()