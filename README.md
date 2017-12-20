---
title: REST Link
---

## ⚠️ This library is under active development ⚠️

This library is under active development. For information on progress check out [this issues](https://github.com/apollographql/apollo-link-rest/issues) or [the design](./designs/initial.md). We would love your help with writing docs, testing, anything! We would love for you, yes you, to be a part of the Apollo community!

## Purpose
An Apollo Link to easily try out GraphQL without a full server. It can be used to prototype, with third-party services that don't have a GraphQL endpoint or in a transition from REST to GraphQL.

## Installation

```bash
npm install apollo-link-rest --save # or `yarn add apollo-link-rest`
```

## Usage

### Basics

```js
import { RestLink } from "apollo-link-rest";
// Other necessary imports...

// Create a RestLink for the Github API
const link = new RestLink({ uri: "https://api.github.com" });

// Configure the ApolloClient with the default cache and RestLink
const client = new ApolloClient({
  cache: new InMemoryCache(),
  link
});

// A simple query to retrieve metada about a this repository
const query = gql`
  query Repo {
    repo @rest(type: "Repo", path: "/repos/apollographql/apollo-link-rest") {
      id
      name
      description
    }
  }
`;

// Invoke the query and log the response data
client.query({ query }).then(response => {
  console.log(response.data.repo);
});
```

[![Edit REST Link Basics](https://codesandbox.io/static/img/play-codesandbox.svg)](https://codesandbox.io/s/zkmnnxk5qp?expanddevtools=1&hidenavigation=1)

### Apollo Client & React Apollo

```js
// Standard React Component, using the injected data prop.
class RepoBase extends React.Component<Props, {}> {
  public render() {
    const { data } = this.props;

    if (data && data.repo) {
      return (
        <div>
          <h3>
            <a href={data.repo.html_url}>{data.repo.name}</a>
          </h3>
          <p>{data.repo.description}</p>
        </div>
      );
    } else {
      return null;
    }
  }
}

// Setup a basic query to retrieve data for that repository given a name
const query = gql`
  query Repo($name: String!) {
    repo(name: $name) @rest(type: "Repo", path: "/repos/apollographql/:name") {
      id
      name
      description
      html_url
    }
  }
`;

// Connect the component using React Apollo's higher order component
// and inject the data into the component. The Result type is what
// we expect the shape of the response to be and OwnProps is what we
// expect to be passed to this component.
const Repo = graphql<Result, OwnProps>(query, {
  options: ({ name }) => ({ variables: { name } })
})(RepoBase);

// Then, to use the <Repo /> component, pass the `name` of the repository
render(
  <ApolloProvider client={client}>
    <Repo name="apollo-client" />
  </ApolloProvider>,
  document.getElementById("root")
);
```

[![Edit REST Link with Apollo Client](https://codesandbox.io/static/img/play-codesandbox.svg)](https://codesandbox.io/s/4q1450o1z7?hidenavigation=1&module=%2FRepo.tsx)

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
