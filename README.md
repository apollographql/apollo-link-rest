# apollo-link-rest

## Problem to solve
You have an existing REST set of services that you have worked on for a long time. However the limitations of it are pilling up and you think GraphQL is a great solution to make your application faster and easier to develop. With `apollo-link-rest`, you can start trying out GraphQL without a full server. You can use it to prototype and even use it for third party services that don't yet have a GraphQL endpoint.

Apollo Link Rest lets you query traditional REST API endpoints while writing GraphQL. It is designed to work with Apollo Client, but can even be used on its own with Apollo Link.

## Status
This library is under active development. For information on progress check out [this issue](https://github.com/apollographql/apollo-link-rest/issues/3) or the design [here](./designs/initial.md). We would love your help! If you want to get involved create or comment on an issue with interest! This could be writing, docs, testing, anything! We would love for you, yes you, to be a part of the Apollo community!

## Contributing
This projects uses TypeScript to bring static types to JavaScript and uses Jest for testing. To get started, clone the repo and run the following commands:

```bash
npm install # you can also run `yarn`
```

To test the library you can run the following:

```bash
npm test # will run all tests once

npm test -- --watch # will run the tests in watch mode, this is super useful when working on the project
```

To run the library locally in another project, you can do the following:

```bash
npm link

# in the project you want to run this in
npm link apollo-link-rest
```js
