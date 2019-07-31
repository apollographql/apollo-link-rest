---
title: REST Link
---

## ⚠️ This library is under active development ⚠️

This library is under active development. For information on progress check out [this issues](https://github.com/apollographql/apollo-link-rest/issues) or [the design](./designs/initial.md). We would love your help with writing docs, testing, anything! We would love for you, yes you, to be a part of the Apollo community!

## Purpose
An Apollo Link to easily try out GraphQL without a full server. It can be used to prototype, with third-party services that don't have a GraphQL endpoint or in a transition from REST to GraphQL.

## Installation

```bash
npm install apollo-link-rest apollo-link graphql graphql-anywhere qs --save # or `yarn add apollo-link-rest apollo-link graphql graphql-anywhere qs`
```

`apollo-link`, `graphql`, `qs` and `graphql-anywhere` are peer dependencies needed by `apollo-link-rest`.

## Usage

### Basics

```js
import { RestLink } from "apollo-link-rest";
// Other necessary imports...

// Create a RestLink for the REST API
// If you are using multiple link types, restLink should go before httpLink,
// as httpLink will swallow any calls that should be routed through rest!
const restLink = new RestLink({
  uri: 'https://swapi.co/api/',
});

// Configure the ApolloClient with the default cache and RestLink
const client = new ApolloClient({
  link: restLink,
  cache: new InMemoryCache(),
});

// A simple query to retrieve data about the first person
const query = gql`
  query luke {
    person @rest(type: "Person", path: "people/1/") {
      name
    }
  }
`;

// Invoke the query and log the person's name
client.query({ query }).then(response => {
  console.log(response.data.person.name);
});
```

[![Edit Basic Example](https://codesandbox.io/static/img/play-codesandbox.svg)](https://codesandbox.io/s/github/apollographql/apollo-link-rest/tree/master/examples/simple)

### Apollo Client & React Apollo

For an example of using REST Link with Apollo Client and React Apollo view this CodeSandbox:

[![Edit Advanced Example](https://codesandbox.io/static/img/play-codesandbox.svg)](https://codesandbox.io/s/github/apollographql/apollo-link-rest/tree/master/examples/advanced)

### TypeScript

For an example of using REST Link with Apollo Client, React Apollo and TypeScript view this CodeSandbox:

[![Edit TypeScript Example](https://codesandbox.io/static/img/play-codesandbox.svg)](https://codesandbox.io/s/github/apollographql/apollo-link-rest/tree/master/examples/typescript)

## Options

REST Link takes an object with some options on it to customize the behavior of the link. The options you can pass are outlined below:

- `uri`: the URI key is a string endpoint (optional when `endpoints` provides a default)
- `endpoints`: root endpoint (uri) to apply paths to or a map of endpoints
- `customFetch`: a custom `fetch` to handle REST calls
- `headers`: an object representing values to be sent as headers on the request
- `credentials`: a string representing the credentials policy you want for the fetch call
- `fieldNameNormalizer`: function that takes the response field name and converts it into a GraphQL compliant name

## Context

REST Link uses the `headers` field on the context to allow passing headers to the HTTP request. It also supports the `credentials` field for defining credentials policy.

- `headers`: an object representing values to be sent as headers on the request
- `credentials`: a string representing the credentials policy you want for the fetch call

## Documentation

For a complete `apollo-link-rest` reference visit the documentation website at: https://www.apollographql.com/docs/link/links/rest.html

## Contributing

This project uses TypeScript to bring static types to JavaScript and uses Jest for testing. To get started, clone the repo and run the following commands:

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

## Related Libraries

- [JSON API Link](https://github.com/Rsullivan00/apollo-link-json-api/) provides
tooling for using GraphQL with JSON API compliant APIs.
- [apollo-type-patcher](https://github.com/mpgon/apollo-type-patcher) declarative type definitions for your REST API with zero dependencies. 
