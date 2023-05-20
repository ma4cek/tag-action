import * as core from '@actions/core'
import {valid, rcompare} from 'semver'
import {listTags, Tag} from './github'

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
