import * as core from '@actions/core'
import {inc, parse, valid} from 'semver'
import {createTag, getBranchFromRef, getLatestTag, getCommits} from './github'

export default async function main(): Promise<void> {
  const commitAnalyzer = require('@semantic-release/commit-analyzer')

  const mainBranches: string[] = ['main', 'master']

  const tagPrefix = core.getInput('tag_prefix')
  const shouldFetchAllTags = core.getInput('fetch_all_tags')

  const {GITHUB_REF, GITHUB_SHA} = process.env

  if (!GITHUB_REF) {
    core.setFailed('Missing GITHUB_REF.')
    return
  }

  const commitRef = GITHUB_SHA
  if (!commitRef) {
    core.setFailed('Missing GITHUB_SHA.')
    return
  }

  const currentBranch = getBranchFromRef(GITHUB_REF)

  if (!mainBranches.includes(currentBranch)) {
    core.setFailed('Trying to tag wrong branch')
    return
  }

  const prefixRegex = new RegExp(`^${tagPrefix}`)

  const latestTag = await getLatestTag(
    prefixRegex,
    /true/i.test(shouldFetchAllTags),
    tagPrefix
  )

  if (!latestTag) {
    core.setFailed('Could not find previous tag.')
    return
  }

  const commits = await getCommits(latestTag.commit.sha, commitRef)

  const previousVersion = parse(latestTag.name.replace(prefixRegex, ''))

  if (!previousVersion) {
    core.setFailed('Could not parse previous tag.')
    return
  }

  core.info(
    `Previous tag was ${latestTag.name}, previous version was ${previousVersion.version}.`
  )
  core.setOutput('previous_version', previousVersion.version)
  core.setOutput('previous_tag', latestTag.name)

  const cwd = process.cwd()

  let bump = await commitAnalyzer.analyzeCommits(
    {
      releaseRules: [
        {type: 'docs', scope: 'README', release: 'patch'},
        {type: 'refactor', release: 'patch'},
        {type: 'style', release: 'patch'}
      ]
    },
    {commits: commits, cwd: cwd}
  )

  const incrementedVersion = inc(previousVersion, 'patch')

  if (!incrementedVersion) {
    core.setFailed('Could not increment version.')
    return
  }

  if (!valid(incrementedVersion)) {
    core.setFailed(`${incrementedVersion} is not a valid semver.`)
    return
  }

  core.info(`New version is ${incrementedVersion}.`)
  core.setOutput('new_version', incrementedVersion)

  const newTag = `${tagPrefix}${incrementedVersion}`
  core.info(`New tag after applying prefix is ${newTag}.`)
  core.setOutput('new_tag', newTag)

  await createTag(newTag, commitRef)
}
