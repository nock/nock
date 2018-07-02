# Contribute

👋 Thanks for thinking about contributing to nock! We, the maintainers, are glad you're here and will be excited to help you get started if you have any questions. For now, here are some basic instructions for how we manage this project.

Please note that this project is released with a [Contributor Code of Conduct](./CODE_OF_CONDUCT.md). By participating in this project you agree to abide by its terms.

**Table of Contents**

<!-- toc -->

- [Commit Message conventions](#commit-message-conventions)
- [Generate README TOC](#generate-readme-toc)
- [Running tests](#running-tests)
  * [Airplane mode](#airplane-mode)

<!-- tocstop -->

### Commit Message conventions

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

### Generate README TOC

Make sure to update the README's table of contents whenever you update the README using the following npm script.

```
$ npm run toc
```

### Running tests

```
$ npm test
```

#### Airplane mode

Some of the tests depend on online connectivity. To skip them, set the `AIRPLANE` environment variable to some value.

```
$ export AIRPLANE=true
$ npm test
```