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

    assignPullRequestIfNoAssignees({ client, baseParams })

    const delta = findReviewCountDelta({ approveViaComment })
    console.log("delta:", delta)
    if (delta == 0) { return }

    const existingApprovalCount = await countApprovalsByOtherUsers({ client, baseParams, sender })
    console.log("existingApprovalCount:", existingApprovalCount)

    const existingLabels = await preserveOtherLabels({ client, baseParams })
    console.log("existingLabels:", existingLabels)

    let plusLabel
    let newLabels = existingLabels

    if (delta > 0) {
      switch(existingApprovalCount) {
        case existingApprovalCount > 1:
          return
        case 1:
          plusLabel = "+2"
          break
        case 0:
          plusLabel = "+1"
          break
        default:
          return
      }
    } else {
      switch(existingApprovalCount) {
        case existingApprovalCount > 2:
          console.log("existingApprovalCount > 2")
          return
        case 2:
          console.log("2")
          plusLabel = "+1"
          break
        case 1:
          console.log("1")
          break
        case existingApprovalCount < 1:
          console.log("existingApprovalCount < 1")
          break
        default:
          console.log("default")
          return
      }
    }

    if (plusLabel) {
      newLabels.push(plusLabel)
    }

    console.log("plusLabel:", plusLabel)
    console.log("newLabels:", newLabels)


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

const preserveOtherLabels = async ({ client, baseParams }) => {
  const labels = await client.rest.issues.listLabelsOnIssue(baseParams)

  return labels
    .data
    .map(label => label.name)
    .filter(l => l !== '' && l !== '+1' && l !== '+2')
}

const countApprovalsByOtherUsers = async ({
  client,
  baseParams,
  sender
}) => {
  const prReviews = await client.request(`GET /repos/${baseParams.owner}/${baseParams.repo}/pulls/${baseParams.issue_number}/reviews`, {
    ...baseParams,
    pull_number: baseParams.issue_number
  })

  return prReviews
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
}

const assignPullRequestIfNoAssignees = async ({
  client, baseParams
}) => {
  const pr = github.context.payload.pull_request
  const assignees = pr.assignees
  const author = pr.user

  console.log("assignees:", assignees)

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

  if (delta == 0 && approveViaComment && github.context.payload?.review?.state == 'commented') {
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