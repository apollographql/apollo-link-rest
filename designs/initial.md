## `@rest` directive

### Arguments

- route: path to rest endpoint. This could be a path or a full url. If a path, add to the endpoint given on link creation or from the context
- provides: a map of variables to url params
- method: the HTTP method to send the request via (i.e GET, PUT, POST)
- type: The GraphQL type this will return

### Notes

It's important that the rest directive could be used at any depth in a query, but once it is used, nothing nested in it can be graphql data, it has to be from the rest link or other resource (like a @client directive)

## `@export` directive

### Arguments
- as: the string name to create this as a variable to be used down the selection set

### Notes

These are the same semantics that will be supported on the server, but when used in a rest link you can use the exported variables for futher calls (i.e. waterfall requests from nested fields)

```js
const QUERY = gql`
  query RestData($email: String!) {
    users @rest(route: '/users/email/:email', provides: { email: $email }, method: 'GET', type: 'User') {
      id @export(as: "id")
      firstName
      lastName
      friends @rest(route: '/friends/:id', provides: { id: $id }, type: '[User]') {
        firstName
        lastName
      }
    }
  }
`;
```


## `createRestLink`

### Arguments

- fetch: an implementation of `fetch` (see the http-link for api / warnings)
- fieldNameNormalizer: a function that takes the response field name and turns into a GraphQL compliant name,for instance "MyFieldName:IsGreat" => myFieldNameIsGreat
- endpoint: a root endpoint to apply routes to: i.e. api.example.com/v1
- batch: a boolean to batch possible calls together (not inital version requirement!)

### Notes

It would be great to support batching of calls to /users if they are sent at the same time (i.e. dataloader) but definitely not something for the first round. Most of the tools around directives could be pulled from the apollo-link-state project to do the same work. For a mixed graphql + rest query, rest should be executed second as it may be nested and need the data (for instance with @export usage)

```js
const link = createRestLink({
  endpoint: "https://api.example.com/v1",
  fetch: nodeFetch,
  fieldNameNormalizer: name => camelCase(name),
  // batch: false
});
```
