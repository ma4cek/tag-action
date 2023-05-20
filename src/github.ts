import {context, getOctokit} from '@actions/github'
import * as core from '@actions/core'

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
