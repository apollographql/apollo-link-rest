# apollo-link-rest

# Design discussion going on [here](https://github.com/apollographql/apollo-link-rest/pull/1)


Use existing REST endpoints with GraphQL

Do not use it in production. There are still many things to do, if you want to contribute feel free to open an issue.

The goal is to allow this kind of queries :

```graphql
query me {
  post @restAPI(type: "Post", endPoint: "/post/1") {
    id
    title
  }
  user {
    name
    id
  }
}
```

So that you can first use your REST API and adopt incrementally GraphQL on your server.

Of course you do not get all the benefits of graphQL by using this package :

* Multiples requests are send when multiple `@restAPI` directives are found.
* You get all the fields from your REST endpoints : filtering is done client side.

## Example Queries

```graphql
query postTitle {
  post @restAPI(type: "Post", endPoint: "/post/1") {
    id
    title
  }
}
```

will make a call to your server and produce 

```graphql
post {
  "__typename": "Post",
  "id": 1,
  "title": "Love apollo"
}
```

You can pass a variable to a query

```graphql
query postTitle($id: ID!) {
  post(id: $id) @restAPI(type: "Post", endPoint: "/post/:id") {
    id
    title
  }
}
```


You can make multiple calls in a query

```graphql
query postAndTags {
  post @restAPI(type: "Post", endPoint: "/post/1") {
    id
    title
  }
  tags @restAPI(type: "Tag", endPoint: "/tags") {
    name
  }
}
```

Please look into the *.test file to see cases we can handle.

## Usage

```js
import RestLink from 'rest-api-link';

const APILink = new RestLink({ uri: 'example.com/api' });

const tagsQuery = gql`query tags {
  tags @restAPI(type: "Tag", endPoint: "/tags") {
    name
  }
}`;

const data = await makePromise(execute(APILink, {
  operationName: "tags",
  query: tagsQuery
}));

```

## Tests

```shell
yarn test
```

>>>>>>> master
