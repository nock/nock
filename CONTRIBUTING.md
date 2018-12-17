# Contribute

👋 Thanks for thinking about contributing to nock! We, the maintainers, are glad you're here and will be excited to help you get started if you have any questions. For now, here are some basic instructions for how we manage this project.

Please note that this project is released with a [Contributor Code of Conduct](./CODE_OF_CONDUCT.md). By participating in this project you agree to abide by its terms.

**Table of Contents**

<!-- toc -->

- [Commit Message conventions](#commit-message-conventions)
- [Beta / Next / Maintenance releases](#beta--next--maintenance-releases)
  * [Backport a fix / feature to a previous version](#backport-a-fix--feature-to-a-previous-version)
  * [Submit a Beta / Next release](#submit-a-beta--next-release)
- [Generate README TOC](#generate-readme-toc)
- [Running tests](#running-tests)
  * [Airplane mode](#airplane-mode)
- [Release Process](#release-process)
- [GitHub Apps](#github-apps)
- [Becoming a maintainer](#becoming-a-maintainer)
- [Generating the CONTRIBUTORS.md file](#generating-the-contributorsmd-file)

<!-- tocstop -->

## Commit Message conventions

`nock` releases are automated using [semantic-release](https://github.com/semantic-release/semantic-release).
To automatically calculate the correct version number as well as changelogs,
three commit message conventions need to be followed

- Commit bug fixes with `fix: ...` or `fix(scope): ...` prefix in commit subject
- Commit new features with `feat: ...` or `feat(scope): ...` prefix in commit subject
- Commit breaking changes by adding `BREAKING CHANGE: ` in the commit body
  (not the subject line)

Other helpful conventions are

- Commit test files with `test: ...` or `test(scope): ...` prefix
- Commit changes to `package.json`, `.gitignore` and other meta files with
  `chore(filename-without-ext): ...`
- Commit changes to README files or comments with `docs: ...`
- Code style changes with `style: standard`

The commit message(s) of a pull request can be fixed using the `squash & merge` button.

## Beta / Next / Maintenance releases

We use [semantic-release](https://github.com/semantic-release/semantic-release) to automate the release of new versions based on semantic commit messages as described above. Depending on the branch that a new pull request is merged into, it is published to different versions using different [npm dist-tags](https://docs.npmjs.com/cli/dist-tag).

- `master`: Publish with `@latest`, or if the commits have been merged into `next` branch before, update the `@latest` dist-tag to point at the new version
- `next`: Publish with `@next`
- `beta`: Publish to `X.0.0-beta.Y`, where `X` is the next breaking version and `Y` is number that gets increased with each release.
- `[Version].x`: For example `10.x`, where `10` is the major release number. No breaking changes are allowed on this branch. Publishes fix/feature versions to `[Version]` using a `@release-@[version].x` release tag

### Backport a fix / feature to a previous version

If you want to **backport a fix** to version 10, and the last version released on version 10 is `10.0.4`, then you have to follow these steps

1. Create the `[Version].x` branch unless it already exists. If you don’t have write access, ask one of the maintainers to do it for you. In this example, then command is `git checkout -b 10.x v10.0.4`.
2. Push the branch to GitHub: `git push -u origin $(git symbolic-ref --short HEAD)`
3. Create a new branch based on `10.x`
4. Make your changes
5. Submit the pull request against the `10.x` branch

### Submit a Beta / Next release

Create a new branch based off `beta` or `next`, depending on what you want. Make your changes and submit them to the same branches. If either `beta` or `next` is outdated, ask a maintainer to re-create them from `master`

## Generate README TOC

Make sure to update the README's table of contents whenever you update the README using the following npm script.

```
$ npm run toc
```

## Running tests

```
$ npm test
```

### Airplane mode

Some of the tests depend on online connectivity. To skip them, set the `AIRPLANE` environment variable to some value.

```
$ export AIRPLANE=true
$ npm test
```

## Release Process

All of our releases are automated using [semantic-release](https://github.com/semantic-release/semantic-release). The commit messages pushed to the master branch trigger new releases. Semantic-release requires that commits follow certain conventions, [described above](#commit-message-conventions). semantic-release creates a GitHub release, adds release notes and publishes the new version to npm. This is why we do not store release notes in the [`CHANGELOG`](CHANGELOG.md) file - they're already on GitHub.

We use @nockbot as a separate account for releases, because npm tokens cannot be scoped to a single package. This improves our security model in case of a data breach involving npm tokens. @nockbot's credentials were set up by @gr2m; contact him if for any reason you need to change this in the future.

## GitHub Apps

We use several GitHub apps to help maintain this repository. While we would like to address every issue and while we would like to be on hand to support every person, Nock is pretty much entirely volunteer run, and we simply don't have the time to do everything. Please don't be offended if an automated app posts in your issue! We're doing what we can with with we have.

Currently, we use the [Stale](https://github.com/apps/stale) and [Lock](https://github.com/apps/lock) apps to mark old issues as stale, and to lock issues which have been closed to stop drive-by comments. You can see the configuration files for these in [.github/](.github).

## Becoming a maintainer

So you want to do more than file a bug or submit a PR? Awesome!

Nock is actively interested in having more maintainers. That means that we would love to have you (yes, you) get more involved if you want to! We don't have strict tests that you need to pass to become a maintainer. Instead, all we want is to find people who are frequent contributors, understand what Nock does, and are eager to help make this tool better.

Here are some things you can do today to actively show the Nock team that you're interested in helping out in the long term:

* **Triage issues!** We have more issues than we have bandwidth to deal with. For some of these issues, there are no labels, no comments suggesting how the issue could be resolved, and no follow-up after months or years of silence. It would be great if the issues actively reflected the state of the project. Go through old issues and suggesting labels in comments, ask for more information, and generally help out with the resolution process. This would be a great help!
* **Review PRs.** We have a lot of open PRs! Some of these are probably ready to merge, and some of them probably need more work. Any extra eyes on PRs are encouraged. Comment on code patterns you think need work, suggest extra tests, and let us know if a PR 'LGTM' ("looks good to me"). The more reviewers we have, the faster we can merge issues, the better this project becomes.
* **Help out!** If someone files a bug and no one has responded yet, see if you can resolve it! Suggest PRs, or file them yourself. While most contributors are going to only be interested in their own bugs, great maintainers help out with other people's bugs. This is one of the best ways to become an expert at Nock (and Node.js, JavaScript, or pretty much any project) - helping others.
* **Write docs.** Are our docs missing something important? Are they not clear? Could they be better? Open a PR!
* **Suggest examples.** Right now, we have a few examples, but we could always have more. Submit small example files and tutorials. At some point, we'll have to work on a better way to display these - for now, it's great to show others how to solve difficult mocking problems easily with Nock.
* **Refactor.** This is one of the hardest things to do, but one of the most useful. Go through the code, and find examples where it could be written better - with better variable names, more useful abstractions, and more elegant patterns. Taking away ten lines of code that are unnecessary is more valuable than submitting a hundred new lines, sometimes. Open a PR or a comment and defend your position; ask for feedback.

Once you've been around for a bit, ask a current Maintainer - one of [the team members](https://github.com/orgs/nock/people) - whether you can be elevated to Maintainer status and given permissions to close issues and merge PRs. We're interested in how well you know what Nock is about, and how involved you are in the community - not where you're from, how good your English is, or whether or not you can pass a whiteboard test blindfolded. If you think that you've been helpful, let us know. We're friendly, promise. :)

## Generating the CONTRIBUTORS.md file

We use [`name-your-contributors`](https://github.com/mntnr/name-your-contributors) to generate the CONTRIBUTORS file, which contains the names of everyone who have submitted code to the Nock codebase, or commented on an issue, or opened a pull request, or reviewed anyone else's code. After all, all contributions are welcome, and anyone who works with Nock is part of our community.

To generate this file, download `name-your-contributors` and set up a GitHub authorization token.

```sh
# Generate a JSON file of the members. This may take a while.
$ name-your-contributors -r nock -u nock > contributors.json
```

To parse that file, we suggest using [`jq`](https://stedolan.github.io/jq/), although other options are clearly possible:

```sh
cat contribs.json | jq '.[][]' | jq '"\(if (.name | length) > 0 then .name else null end) @\(.login) \(.url)"' | jq '. | tostring' | jq -s . | jq unique | jq .[] > CONTRIBUTORS.md
```

Note: This is a convoluted and time-intensive process, and could be updated in several ways. For one, `name-your-contributors` accepts a date flag, which could be used to only catch recent entries. Another way would be to use a bot to automate this at some regular interval. Any help on this would be appreciated.
