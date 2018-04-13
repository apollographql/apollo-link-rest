# RestLink Docs

The purpose of this directory is to have an in-repo copy of the `RestLink` documentation. It however truly lives in [`apollo-link`](https://www.apollographql.com/docs/link/links/rest.html)

If you make changes in this directory, once the PR lands, please make sure it gets copied/merged into [apollographql/apollo-link](https://github.com/apollographql/apollo-link/blob/master/docs/source/links/rest.md)

To help with this, we have these commands:

```shell
# This will check to see if we're out of date
$ yarn docs:check

# Pushes documentation into a checkout of apollo-link for you to commit
$ yarn docs:push

# Pulls docs from apollo-link into your current checkout of apollo-link-rest
$ yarn docs:pull
```