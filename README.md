# Apollo API Rest Link

## Example Query

```graphql
query postTitle {
  post @restAPI(type: "Post", route: "/post/1") {
    id
    title
  }
}
```

will make a call to your server and produce 

```
post {
  __typename: "Post",
  "id"
  "title"
}
```

## Tests

```shell
yarn test
```
