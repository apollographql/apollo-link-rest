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

## Tests

```shell
yarn test
```
