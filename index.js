const core = require('@actions/core')
const github = require('@actions/github')

const run = async () => {
  try {
    const githubToken = core.getInput('github_token')
    const approveViaComment = core.getInput('approve_via_comment') == '' ? false : true

    if (!approveViaComment && github.context.payload?.review?.state == 'commented') {
      return
    }

    console.log("user:", github.context.payload.sender.login)

    const sender = github.context.payload.sender.login


    if (!githubToken) {
      throw Error(`input 'github_token' is required`)
    }
    const client = github.getOctokit(githubToken)

    const owner = github.context.payload.repository.owner.login
    const repo = github.context.payload.repository.name
    const issue_number = github.context.payload.pull_request.number

    const baseParams = {
      owner,
      repo,
      issue_number
    }

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
    if (delta == 0) { return }

    // const pr = await client.rest.issues.get(baseParams)

    // console.log("pr:", pr)

    const prReviews = await client.request(`GET /repos/${owner}/${repo}/pulls/${issue_number}/reviews`, {
      owner,
      repo,
      pull_number: issue_number
    })

    console.log("prReview last:", prReviews.data[prReviews.data.length - 1])

    console.log("prReviews:", prReviews)

    existingApprovalCount = prReviews
      .data
      .flatMap((review, i, {length}) => {
        if (length - 1 !== i) {
          return [review.state]
        } else {
          return []
        }
      })
      .filter(r => r == 'APPROVED' && r.user.login != sender)
      .length

    dismissals = prReviews
      .data
      .flatMap((review, i, {length}) => {
        if (length - 1 !== i) {
          return [review.state]
        } else {
          return []
        }
      })
      .filter(r => r == 'DISMISSED' && r.user.login != sender)
      .length

    // const existingApprovalCount = approvals - dismissals
    console.log("delta:", delta, "dismissals:", dismissals, "existingApprovalCount:", existingApprovalCount)

    const labels = await client.rest.issues.listLabelsOnIssue(baseParams)

    // const existingPlusLabels = labels
    //   .data
    //   .map(label => label.name)
    //   .filter(l => l == '+1' || l == '+2')

    const existingLabels = labels
      .data
      .map(label => label.name)
      .filter(l => l !== '' && l !== '+1' && l !== '+2')

    console.log('existingLabels:', existingLabels)
    // console.log('existingPlusLabels:', existingPlusLabels)

    // let currentPlusValue = 0
    // if (existingPlusLabels.includes("+1")) { currentPlusValue = 1 }
    // if (existingPlusLabels.includes("+2")) { currentPlusValue = 2 }

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

    console.log('newLabel:', newLabel)

    if (newLabel) {
      newLabels.push(newLabel)
    }

    console.log('newLabels:', newLabels)

    client.rest.issues.setLabels({
      ...baseParams,
      labels: newLabels
    })

  } catch (error) {
    console.log('Error:', error)
    core.error(error)
    core.setFailed(error)
  }
}

run()