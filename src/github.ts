import {context, getOctokit} from '@actions/github'
import * as core from '@actions/core'
import {valid, rcompare} from 'semver'

export type Tag = {
  name: string
  commit: {
    sha: string
    url: string
  }
}

let octokitSingleton: ReturnType<typeof getOctokit>

/**
 * Method to return an Ocktokit singleton for futher Github operations
 *
 * @returns Octokit Singleton
 */
export function getOctokitSingleton(): ReturnType<typeof getOctokit> {
  if (octokitSingleton) {
    return octokitSingleton
  }
  const githubToken = core.getInput('github_token')
  octokitSingleton = getOctokit(githubToken)
  return octokitSingleton
}

/**
 * Fetch all tags for a given repository recursively
 *
 * @param shouldFetchAllTags - fetch all or first 100
 * @param fetchedTags
 * @param page
 */
export async function listTags(
  shouldFetchAllTags = false,
  fetchedTags: Tag[] = [],
  page = 1
): Promise<Tag[]> {
  const octokit = getOctokitSingleton()

  const tags = await octokit.rest.repos.listTags({
    ...context.repo,
    per_page: 100,
    page
  })

  // number of tags is < 100 or only 1st page should be returned
  if (tags.data.length < 100 || shouldFetchAllTags === false) {
    return [...fetchedTags, ...tags.data]
  }

  // else run method recursively
  return listTags(shouldFetchAllTags, [...fetchedTags, ...tags.data], page + 1)
}

export async function createTag(
  newTag: string,
  GITHUB_SHA: string
): Promise<void> {
  const octokit = getOctokitSingleton()

  core.debug(`Pushing new tag to the repo.`)
  await octokit.rest.git.createRef({
    ...context.repo,
    ref: `refs/tags/${newTag}`,
    sha: GITHUB_SHA
  })
}

/**
 *
 * @param baseRef
 * @param headRef
 * @returns
 */
export async function getCommits(
  baseRef: string,
  headRef: string
): Promise<{message: string; hash: string | null}[]> {
  const octokit = getOctokitSingleton()
  core.debug(`Comparing commits (${baseRef}...${headRef})`)

  const commits = await octokit.rest.repos.compareCommits({
    ...context.repo,
    base: baseRef,
    head: headRef
  })

  return commits.data.commits
    .filter(commit => !!commit.commit.message)
    .map(commit => ({
      message: commit.commit.message,
      hash: commit.sha
    }))
}

/**
 * Returns list of valid tags from repo
 *
 * @param prefixRegex
 * @param shouldFetchAllTags
 * @returns sorted list of valid tags
 */
export async function getLatestTag(
  prefixRegex: RegExp,
  shouldFetchAllTags: boolean,
  tagPrefix: string
): Promise<Tag> {
  const tags = await listTags(shouldFetchAllTags)

  // tag does not contain prefixRegex or tag without prefixRegex does not validate as semver
  const invalidTags = tags.filter(
    tag =>
      !prefixRegex.test(tag.name) || !valid(tag.name.replace(prefixRegex, ''))
  )

  for (const tag of invalidTags) core.debug(`Found Invalid Tag: ${tag.name}.`)

  // valid tags sorted without prefixRegex
  const validTags = tags
    .filter(
      tag =>
        prefixRegex.test(tag.name) && valid(tag.name.replace(prefixRegex, ''))
    )
    .sort((a, b) =>
      rcompare(a.name.replace(prefixRegex, ''), b.name.replace(prefixRegex, ''))
    )

  for (const tag of validTags) core.debug(`Found Valid Tag: ${tag.name}.`)

  if (tags.length > 0) return tags[0]
  else
    return {
      name: `${tagPrefix}0.0.0`,
      commit: {
        sha: 'HEAD',
        url: ''
      }
    }
}

export function getBranchFromRef(ref: string): string {
  return ref.replace('refs/heads/', '')
}
