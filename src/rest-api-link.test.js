import { execute, makePromise } from 'apollo-link'
import gql from 'graphql-tag'
import fetchMock from 'fetch-mock'
import RestAPILink from './rest-api-link'

describe('Query', () => {
  afterEach(() => {
    fetchMock.restore()
  })

  it('can run a simple query', async () => {
    expect.assertions(1)

    const link = new RestAPILink({ uri: "/api" });
    const post = { id: '1', title: 'Love apollo' };
    fetchMock.get('/api/post/1', post);

    const postTitleQuery = gql`
      query postTitle {
        post @restAPI(type: "Post", route: "/post/1") {
          id
          title
        }
      }
    `

    const data = await makePromise(
      execute(link, {
        operationName: 'postTitle',
        query: postTitleQuery,
      }),
    )

    expect(data).toMatchObject({ post: { ...post, __typename: "Post" } });
  })

  it("can filter the query result", async () => {
    expect.assertions(1);

    const link = new RestAPILink({ uri: "/api" });

    const post = { id: "1", title: "Love apollo", content: "Best graphql client ever." };
    fetchMock.get("/api/post/1", post);

    const postTitleQuery = gql`query postTitle {
        post @restAPI(type: "Post", route: "/post/1") {
          id
          title
        }
      }`;

    const data = await makePromise(execute(link, {
      operationName: "postWithContent",
      query: postTitleQuery
    }));

    expect(data.post.content).toBeUndefined()
  });

  it("can pass param to a query without a variable", async () => {
    expect.assertions(1);

    const link = new RestAPILink({ uri: "/api" });

    const post = { id: "1", title: "Love apollo" };
    fetchMock.get("/api/post/1", post);

    const postTitleQuery = gql`query postTitle {
        post(id: "1") @restAPI(type: "Post", route: "/post/:id") {
          id
          title
        }
      }`;

    const data = await makePromise(execute(link, {
        operationName: "postTitle",
        query: postTitleQuery
      }));

    expect(data.post.title).toBe(post.title);
  });

  it("can pass param to a query with a variable", async () => {
    expect.assertions(1);

    const link = new RestAPILink({ uri: "/api" });

    const post = { id: "1", title: "Love apollo" };
    fetchMock.get("/api/post/1", post);

    const postTitleQuery = gql`query postTitle($id: ID!) {
        post(id: $id) @restAPI(type: "Post", route: "/post/:id") {
          id
          title
        }
      }`;

    const data = await makePromise(execute(link, {
        operationName: "postTitle",
        query: postTitleQuery,
        variables: { id: '1' },
      }));

    expect(data.post.title).toBe(post.title);
  });
})
