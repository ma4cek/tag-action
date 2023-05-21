import * as core from '@actions/core'
import {inc, parse, valid} from 'semver'
import {createTag, getBranchFromRef, getLatestTag, getCommits} from './github'

export default async function main(): Promise<void> {
  const mainBranches: string[] = ['main', 'master']

  const releaseNotesGenerator = require('@semantic-release/release-notes-generator')

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

  /**
   * Generate the changelog for all the commits in `options.commits`.
   *
   * @param {Object} pluginConfig The plugin configuration.
   * @param {String} pluginConfig.preset conventional-changelog preset ('angular', 'atom', 'codemirror', 'ember', 'eslint', 'express', 'jquery', 'jscs', 'jshint').
   * @param {String} pluginConfig.config Requireable npm package with a custom conventional-changelog preset
   * @param {Object} pluginConfig.parserOpts Additional `conventional-changelog-parser` options that will overwrite ones loaded by `preset` or `config`.
   * @param {Object} pluginConfig.writerOpts Additional `conventional-changelog-writer` options that will overwrite ones loaded by `preset` or `config`.
   * @param {Object} context The semantic-release context.
   * @param {Array<Object>} context.commits The commits to analyze.
   * @param {Object} context.lastRelease The last release with `gitHead` corresponding to the commit hash used to make the last release and `gitTag` corresponding to the git tag associated with `gitHead`.
   * @param {Object} context.nextRelease The next release with `gitHead` corresponding to the commit hash used to make the  release, the release `version` and `gitTag` corresponding to the git tag associated with `gitHead`.
   * @param {Object} context.options.repositoryUrl The git repository URL.
   */

  const changelog = await releaseNotesGenerator.generateNotes(
    {
      preset: 'conventionalcommits'
    },
    {
      commits,
      options: {
        //repositoryUrl: `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}`
        repositoryUrl: 'https://github.com/ma4cek/test.git'
      },
      lastRelease: {gitTag: latestTag.name},
      nextRelease: {gitTag: newTag, version: incrementedVersion}
    }
  )
  core.info(`Changelog is ${changelog}.`)
  core.setOutput('changelog', changelog)

  await createTag(newTag, commitRef)
}
