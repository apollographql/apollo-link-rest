---
title: REST Link
---

## ⚠️ This library is under active development ⚠️

This library is under active development. For information on progress check out
[this issue](https://github.com/apollographql/apollo-link-rest/issues/3) or the
design [here](./designs/initial.md). We would love your help with writing, docs,
testing, anything! We would love for you, yes you, to be a part of the Apollo
community!

## Purpose

An Apollo Link to easily try out GraphQL without a full server. It can be used
to prototype, with third-party services that don't have a GraphQL endpoint or
in a transition from REST to GraphQL.

## Installation

***Not yet published***

## Usage

```js
import { RestLink } from "...";

const link = new RestLink({ uri: '/api' });
```

## Options

REST Link takes an object with some options on it to customize the behavior of
the link. The options you can pass are outlined below:

- `uri`: the URI key is a string endpoint (optional when `endpoints` provides
  a default)
- `endpoints`: root endpoint (uri) to apply paths to or a map of endpoints
- `customFetch`: a custom `fetch` to handle REST calls
- `headers`: an object representing values to be sent as headers on the request
- `credentials`: a string representing the credentials policy you want for the
  fetch call
- `fieldNameNormalizer`: function that takes the response field name and
  converts it into a GraphQL compliant name

## Context

The REST Link uses the `headers` field on the context to allow passing headers
to the HTTP request. It also supports the `credentials` field for defining
credentials policy.

- `headers`: an object representing values to be sent as headers on the request
- `credentials`: a string representing the credentials policy you want for the
  fetch call

## Contributing

This project uses TypeScript to bring static types to JavaScript and uses Jest
for testing. To get started, clone the repo and run the following commands:

```bash
npm install # or `yarn`

npm test # or `yarn test` to run tests
npm test -- --watch # run tests in watch mode

npm run check-types # or `yarn check-types` to check TypeScript types
```

To run the library locally in another project, you can do the following:

```bash
npm link

# in the project you want to run this in
npm link apollo-link-rest
```
