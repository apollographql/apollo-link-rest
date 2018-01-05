import { execute, makePromise, ApolloLink } from 'apollo-link';
import { ApolloClient } from 'apollo-client';
import { InMemoryCache } from 'apollo-cache-inmemory';
import gql from 'graphql-tag';
import * as camelCase from 'camelcase';
const snake_case = require('snake-case');
import * as fetchMock from 'fetch-mock';

import { RestLink } from '../';
import {
  validateRequestMethodForOperationType,
  normalizeHeaders,
} from '../restLink';

const sampleQuery = gql`
  query post {
    post(id: "1") @rest(type: "Post", path: "/post/:id") {
      id
    }
  }
`;

type Result = { [index: string]: any };

describe('Configuration', () => {
  describe('Errors', () => {
    it('throws without any config', () => {
      expect.assertions(3);

      expect(() => {
        new RestLink(undefined);
      }).toThrow();
      expect(() => {
        new RestLink({} as any);
      }).toThrow();
      expect(() => {
        new RestLink({ bogus: '' } as any);
      }).toThrow();
    });

    it('throws with mismatched config', () => {
      expect.assertions(1);
      expect(() => {
        new RestLink({ uri: '/correct', endpoints: { '': '/mismatched' } });
      }).toThrow();
    });

    it("Doesn't throw on good configs", () => {
      expect.assertions(1);

      new RestLink({ uri: '/correct' });
      new RestLink({ uri: '/correct', endpoints: { other: '/other' } });
      new RestLink({
        uri: '/correct',
        endpoints: { '': '/correct', other: '/other' },
      });
      new RestLink({ endpoints: { '': '/correct', other: '/other' } });

      expect(true).toBe(true);
    });
  });

  describe('Field name normalizer', () => {
    afterEach(() => {
      fetchMock.restore();
    });
    it('should apply fieldNameNormalizer if specified', async () => {
      expect.assertions(2);
      const link = new RestLink({
        uri: '/api',
        fieldNameNormalizer: camelCase,
      });
      const post = { id: '1', Title: 'Love apollo' };
      fetchMock.get('/api/post/1', post);

      const tags = [{ Name: 'apollo' }, { Name: 'graphql' }];
      fetchMock.get('/api/tags', tags);

      const postAndTags = gql`
        query postAndTags {
          post @rest(type: "Post", path: "/post/1") {
            id
            Title
            Tags @rest(type: "[Tag]", path: "/tags") {
              Name
            }
          }
        }
      `;

      const { data } = await makePromise<Result>(
        execute(link, {
          operationName: 'postTitle',
          query: postAndTags,
        }),
      );

      expect(data.post.title).toBeDefined();
      expect(data.post.tags[0].name).toBeDefined();
    });
    it.skip('fieldNameNormalizer Too Late graphql-anywhere issues/2744', async () => {
      // https://github.com/apollographql/apollo-client/issues/2744
      expect.assertions(1);

      const link = new RestLink({
        uri: '/api',
        fieldNameNormalizer: camelCase,
      });

      // the id in this hash simulates the server *assigning* an id for the new post
      const snakePost = { id: 1, title_string: 'Love apollo', category_id: 6 };
      const camelPost = { id: 1, titleString: 'Love apollo', categoryId: 6 };
      fetchMock.get('/api/posts/1', snakePost);
      const resultPost = camelPost;

      const getPostQuery = gql`
        query lookupPost($id: String!) {
          post(id: $id) @rest(type: "Post", path: "/posts/1", method: "GET") {
            id
            titleString
            categoryId
          }
        }
      `;
      const response = await makePromise<Result>(
        execute(link, {
          operationName: 'lookupPost',
          query: getPostQuery,
          variables: { id: camelPost.id },
        }),
      );
      expect(response.data.post).toEqual(resultPost);
    });
    it('fieldNameNormalizer Too Late - Workaround 1', async () => {
      expect.assertions(1);

      const link = new RestLink({
        uri: '/api',
        fieldNameNormalizer: camelCase,
      });

      // the id in this hash simulates the server *assigning* an id for the new post
      const snakePost = { id: 1, title_string: 'Love apollo', category_id: 6 };
      const camelPost = { id: 1, titleString: 'Love apollo', categoryId: 6 };
      fetchMock.get('/api/posts/1', snakePost);
      const resultPost = camelPost;

      const getPostQuery = gql`
        query lookupPost($id: String!) {
          post(id: $id) @rest(type: "Post", path: "/posts/1", method: "GET") {
            id
            title_string
            category_id
          }
        }
      `;
      const response = await makePromise<Result>(
        execute(link, {
          operationName: 'lookupPost',
          query: getPostQuery,
          variables: { id: camelPost.id },
        }),
      );
      expect(response.data.post).toEqual(resultPost);
    });
    it('fieldNameNormalizer Too Late - Workaround 2', async () => {
      expect.assertions(1);

      const link = new RestLink({
        uri: '/api',
        fieldNameNormalizer: camelCase,
      });

      // the id in this hash simulates the server *assigning* an id for the new post
      const snakePost = { id: 1, title_string: 'Love apollo', category_id: 6 };
      const camelPost = { id: 1, titleString: 'Love apollo', categoryId: 6 };
      fetchMock.get('/api/posts/1', snakePost);
      const resultPost = camelPost;

      const getPostQuery = gql`
        query lookupPost($id: String!) {
          post(id: $id) @rest(type: "Post", path: "/posts/1", method: "GET") {
            id
            title_string
            titleString
            category_id
            categoryId
          }
        }
      `;
      const response = await makePromise<Result>(
        execute(link, {
          operationName: 'lookupPost',
          query: getPostQuery,
          variables: { id: camelPost.id },
        }),
      );
      expect(response.data.post).toEqual(resultPost);
    });
  });
  describe('Custom getJSON', () => {
    afterEach(() => {
      fetchMock.restore();
    });
    it('should apply custom getJSON if specified', async () => {
      expect.assertions(1);
      const link = new RestLink({
        uri: '/api',
        customGetJSON: (uri, options) => Promise.resolve({ title: 'custom' }),
      });

      const postTitle = gql`
        query postTitle {
          post @rest(type: "Post", path: "/post/1") {
            title
          }
        }
      `;

      const { data } = await makePromise(
        execute(link, {
          operationName: 'postTitle',
          query: postTitle,
        }),
      );

      expect(data.post.title).toBe('custom');
    });
  });
  describe('Custom fetch', () => {
    afterEach(() => {
      fetchMock.restore();
    });
    it('should apply customFetch if specified', async () => {
      expect.assertions(1);

      const link = new RestLink({
        uri: '/api',
        customFetch: (uri, options) =>
          new Promise((resolve, reject) => {
            const body = JSON.stringify({ title: 'custom' });
            resolve(new Response(body));
          }),
      });

      const postTitle = gql`
        query postTitle {
          post @rest(type: "Post", path: "/post/1") {
            title
          }
        }
      `;

      const { data } = await makePromise(
        execute(link, {
          operationName: 'postTitle',
          query: postTitle,
        }),
      );

      expect(data.post.title).toBe('custom');
    });
  });
});

describe('Query single call', () => {
  afterEach(() => {
    fetchMock.restore();
  });

  it('can run a simple query', async () => {
    expect.assertions(1);

    const link = new RestLink({ uri: '/api' });
    const post = { id: '1', title: 'Love apollo' };
    fetchMock.get('/api/post/1', post);

    const postTitleQuery = gql`
      query postTitle {
        post @rest(type: "Post", path: "/post/1") {
          id
          title
        }
      }
    `;

    const { data } = await makePromise<Result>(
      execute(link, {
        operationName: 'postTitle',
        query: postTitleQuery,
      }),
    );

    expect(data).toMatchObject({ post: { ...post, __typename: 'Post' } });
  });

  it('can get query params regardless of the order', async () => {
    expect.assertions(1);

    const link = new RestLink({ uri: '/api' });
    const post = { id: '1', title: 'Love apollo' };
    fetchMock.get('/api/post/1', post);

    const postTitleQuery = gql`
      query postTitle {
        post @rest(path: "/post/1", type: "Post") {
          id
          title
        }
      }
    `;

    const { data } = await makePromise<Result>(
      execute(link, {
        operationName: 'postTitle',
        query: postTitleQuery,
      }),
    );

    expect(data).toMatchObject({ post });
  });

  it('can return array result with typename', async () => {
    expect.assertions(1);

    const link = new RestLink({ uri: '/api' });

    const tags = [{ name: 'apollo' }, { name: 'graphql' }];
    fetchMock.get('/api/tags', tags);

    const tagsQuery = gql`
      query tags {
        tags @rest(type: "[Tag]", path: "/tags") {
          name
        }
      }
    `;

    const { data } = await makePromise<Result>(
      execute(link, {
        operationName: 'tags',
        query: tagsQuery,
      }),
    );

    const tagsWithTypeName = tags.map(tag => ({
      ...tag,
      __typename: '[Tag]',
    }));
    expect(data).toMatchObject({ tags: tagsWithTypeName });
  });

  it('can filter the query result', async () => {
    expect.assertions(1);

    const link = new RestLink({ uri: '/api' });

    const post = {
      id: '1',
      title: 'Love apollo',
      content: 'Best graphql client ever.',
    };
    fetchMock.get('/api/post/1', post);

    const postTitleQuery = gql`
      query postTitle {
        post @rest(type: "Post", path: "/post/1") {
          id
          title
        }
      }
    `;

    const { data } = await makePromise<Result>(
      execute(link, {
        operationName: 'postWithContent',
        query: postTitleQuery,
      }),
    );

    expect(data.post.content).toBeUndefined();
  });

  it('can pass param to a query without a variable', async () => {
    expect.assertions(1);

    const link = new RestLink({ uri: '/api' });
    const post = { id: '1', title: 'Love apollo' };
    fetchMock.get('/api/post/1', post);

    const postTitleQuery = gql`
      query postTitle {
        post @rest(type: "Post", path: "/post/1") {
          id
          title
        }
      }
    `;

    const { data } = await makePromise<Result>(
      execute(link, {
        operationName: 'postTitle',
        query: postTitleQuery,
      }),
    );

    expect(data).toMatchObject({ post: { ...post, __typename: 'Post' } });
  });

  it('can pass param to a query with a variable', async () => {
    expect.assertions(1);

    const link = new RestLink({ uri: '/api' });

    const post = { id: '1', title: 'Love apollo' };
    fetchMock.get('/api/post/1', post);

    const postTitleQuery = gql`
      query postTitle {
        post(id: "1") @rest(type: "Post", path: "/post/:id") {
          id
          title
        }
      }
    `;

    const { data } = await makePromise<Result>(
      execute(link, {
        operationName: 'postTitle',
        query: postTitleQuery,
        variables: { id: '1' },
      }),
    );

    expect(data.post.title).toBe(post.title);
  });

  it('can hit two endpoints!', async () => {
    expect.assertions(2);

    const link = new RestLink({ endpoints: { v1: '/v1', v2: '/v2' } });

    const postV1 = { id: '1', title: '1. Love apollo' };
    const postV2 = { id: '1', titleText: '2. Love apollo' };
    fetchMock.get('/v1/post/1', postV1);
    fetchMock.get('/v2/post/1', postV2);

    const postTitleQuery1 = gql`
      query postTitle($id: ID!) {
        post(id: $id) @rest(type: "Post", path: "/post/:id", endpoint: "v1") {
          id
          title
        }
      }
    `;
    const postTitleQuery2 = gql`
      query postTitle($id: ID!) {
        post(id: $id) @rest(type: "Post", path: "/post/:id", endpoint: "v2") {
          id
          titleText
        }
      }
    `;

    const { data: data1 } = await makePromise<Result>(
      execute(link, {
        operationName: 'postTitle1',
        query: postTitleQuery1,
        variables: { id: '1' },
      }),
    );
    const { data: data2 } = await makePromise<Result>(
      execute(link, {
        operationName: 'postTitle2',
        query: postTitleQuery2,
        variables: { id: '1' },
      }),
    );

    expect(data1.post.title).toBe(postV1.title);
    expect(data2.post.titleText).toBe(postV2.titleText);
  });

  it('can make a doubly nested query!', async () => {
    expect.assertions(1);

    const link = new RestLink({ uri: '/api' });
    const post = {
      id: '1',
      title: 'Love apollo',
      nested: { data: 'test', secondNestKey: 'proof' },
    };
    const postWithNest = { ...post };
    (postWithNest.nested as any).test = {
      __typename: 'Inner',
      positive: 'winning',
    };

    fetchMock.get('/api/post/1', post);
    fetchMock.get('/api/post/proof', { positive: 'winning' });

    const postTitleQuery = gql`
      query postTitle {
        post @rest(type: "Post", path: "/post/1") {
          id
          title
          nested {
            data
            secondNestKey @export(as: innerNest)
            test @rest(type: "Inner", path: "/post/:innerNest") {
              positive
            }
          }
        }
      }
    `;

    const { data } = await makePromise<Result>(
      execute(link, {
        operationName: 'postTitle',
        query: postTitleQuery,
      }),
    );

    expect(data).toMatchObject({
      post: { ...postWithNest, __typename: 'Post' },
    });
  });
});

describe('Query multiple calls', () => {
  afterEach(() => {
    fetchMock.restore();
  });

  it('can run a query with multiple rest calls', async () => {
    expect.assertions(2);
    ``;

    const link = new RestLink({ uri: '/api' });

    const post = { id: '1', title: 'Love apollo' };
    fetchMock.get('/api/post/1', post);

    const tags = [{ name: 'apollo' }, { name: 'graphql' }];
    fetchMock.get('/api/tags', tags);

    const postAndTags = gql`
      query postAndTags {
        post @rest(type: "Post", path: "/post/1") {
          id
          title
        }
        tags @rest(type: "[Tag]", path: "/tags") {
          name
        }
      }
    `;

    const { data } = await makePromise<Result>(
      execute(link, {
        operationName: 'postAndTags',
        query: postAndTags,
      }),
    );

    expect(data.post).toBeDefined();
    expect(data.tags).toBeDefined();
  });

  it('can run a subquery with multiple rest calls', async () => {
    expect.assertions(2);
    ``;

    const link = new RestLink({ uri: '/api' });

    const post = { id: '1', title: 'Love apollo' };
    fetchMock.get('/api/post/1', post);

    const tags = [{ name: 'apollo' }, { name: 'graphql' }];
    fetchMock.get('/api/tags', tags);

    const postAndTags = gql`
      query postAndTags {
        post @rest(type: "Post", path: "/post/1") {
          id
          title
          tags @rest(type: "[Tag]", path: "/tags") {
            name
          }
        }
      }
    `;

    const { data } = await makePromise<Result>(
      execute(link, {
        operationName: 'postAndTags',
        query: postAndTags,
      }),
    );

    expect(data.post).toBeDefined();
    expect(data.post.tags).toBeDefined();
  });

  +it('GraphQL aliases should work', async () => {
    expect.assertions(2);

    const link = new RestLink({ endpoints: { v1: '/v1', v2: '/v2' } });

    const postV1 = { id: '1', title: '1. Love apollo' };
    const postV2 = { id: '1', titleText: '2. Love apollo' };
    fetchMock.get('/v1/post/1', postV1);
    fetchMock.get('/v2/post/1', postV2);

    const postTitleQueries = gql`
      query postTitle($id: ID!) {
        v1: post(id: $id)
          @rest(type: "Post", path: "/post/:id", endpoint: "v1") {
          id
          title
        }
        v2: post(id: $id)
          @rest(type: "Post", path: "/post/:id", endpoint: "v2") {
          id
          titleText
        }
      }
    `;

    const { data } = await makePromise<Result>(
      execute(link, {
        operationName: 'postTitle',
        query: postTitleQueries,
        variables: { id: '1' },
      }),
    );

    expect(data.v1.title).toBe(postV1.title);
    expect(data.v2.titleText).toBe(postV2.titleText);
  });
});

describe('Query options', () => {
  afterEach(() => {
    fetchMock.restore();
  });
  describe('credentials', () => {
    it('adds credentials to the request from the setup', async () => {
      expect.assertions(1);
      const link = new RestLink({
        uri: '/api',
        // Casting to RequestCredentials for testing purposes,
        // the only valid values here defined by RequestCredentials from Fetch
        // and typescript will yell at you for violating this!
        credentials: 'my-credentials' as RequestCredentials,
      });

      const post = { id: '1', Title: 'Love apollo' };
      fetchMock.get('/api/post/1', post);

      await makePromise<Result>(
        execute(link, {
          operationName: 'post',
          query: sampleQuery,
        }),
      );

      const credentials = fetchMock.lastCall()[1].credentials;
      expect(credentials).toBe('my-credentials');
    });

    it('adds credentials to the request from the context', async () => {
      expect.assertions(2);

      const credentialsMiddleware = new ApolloLink((operation, forward) => {
        operation.setContext({
          credentials: 'my-credentials',
        });
        return forward(operation).map(result => {
          const { credentials } = operation.getContext();
          expect(credentials).toBeDefined();
          return result;
        });
      });

      const link = ApolloLink.from([
        credentialsMiddleware,
        new RestLink({ uri: '/api' }),
      ]);

      const post = { id: '1', title: 'Love apollo' };
      fetchMock.get('/api/post/1', post);

      await makePromise<Result>(
        execute(link, {
          operationName: 'post',
          query: sampleQuery,
        }),
      );

      const credentials = fetchMock.lastCall()[1].credentials;
      expect(credentials).toBe('my-credentials');
    });

    it('prioritizes context credentials over setup credentials', async () => {
      expect.assertions(2);

      const credentialsMiddleware = new ApolloLink((operation, forward) => {
        operation.setContext({
          credentials: 'my-credentials',
        });
        return forward(operation).map(result => {
          const { credentials } = operation.getContext();
          expect(credentials).toBeDefined();
          return result;
        });
      });

      const link = ApolloLink.from([
        credentialsMiddleware,
        new RestLink({
          uri: '/api',
          credentials: 'wrong-credentials' as RequestCredentials,
        }),
      ]);

      const post = { id: '1', title: 'Love apollo' };
      fetchMock.get('/api/post/1', post);

      await makePromise<Result>(
        execute(link, {
          operationName: 'post',
          query: sampleQuery,
        }),
      );

      const credentials = fetchMock.lastCall()[1].credentials;
      expect(credentials).toBe('my-credentials');
    });
  });
  describe('method', () => {
    it('works for GET requests', async () => {
      expect.assertions(1);

      const link = new RestLink({ uri: '/api' });

      const post = { id: '1', title: 'Love apollo' };
      fetchMock.get('/api/post/1', post);

      const postTitleQuery = gql`
        query postTitle {
          post(id: "1") @rest(type: "Post", path: "/post/:id", method: "GET") {
            id
            title
          }
        }
      `;

      await makePromise<Result>(
        execute(link, {
          operationName: 'postTitle',
          query: postTitleQuery,
          variables: { id: '1' },
        }),
      );

      const requestCall = fetchMock.calls('/api/post/1')[0];
      expect(requestCall[1]).toEqual(
        expect.objectContaining({ method: 'GET' }),
      );
    });

    it('works without specifying a request method', async () => {
      expect.assertions(1);

      const link = new RestLink({ uri: '/api' });

      const post = { id: '1', title: 'Love apollo' };
      fetchMock.get('/api/post/1', post);

      const postTitleQuery = gql`
        query postTitle {
          post(id: "1") @rest(type: "Post", path: "/post/:id") {
            id
            title
          }
        }
      `;

      await makePromise<Result>(
        execute(link, {
          operationName: 'postTitle',
          query: postTitleQuery,
          variables: { id: '1' },
        }),
      );

      const requestCall = fetchMock.calls('/api/post/1')[0];
      expect(requestCall[1]).toEqual(
        expect.objectContaining({ method: 'GET' }),
      );
    });

    it('throws if query method is not GET', async () => {
      expect.assertions(2);

      const link = new RestLink({ uri: '/api' });

      const post = { id: '1', title: 'Love apollo' };
      fetchMock.get('/api/post/1', post);

      const postTitleQuery = gql`
        query postTitle {
          post(id: "1") @rest(type: "Post", path: "/post/:id", method: "POST") {
            id
            title
          }
        }
      `;

      try {
        await makePromise<Result>(
          execute(link, {
            operationName: 'postTitle',
            query: postTitleQuery,
            variables: { id: '1' },
          }),
        );
      } catch (error) {
        expect(error.message).toBe(
          'A "query" operation can only support "GET" requests but got "POST".',
        );
      }

      expect(fetchMock.called('/api/post/1')).toBe(false);
    });
  });

  /** Helper for extracting a simple object of headers from the HTTP-fetch Headers class */
  const flattenHeaders: ({ headers: Headers }) => { [key: string]: string } = ({
    headers,
  }) => {
    const headersFlattened: { [key: string]: string } = {};
    headers.forEach((value, key) => {
      headersFlattened[key] = value;
    });
    return headersFlattened;
  };

  /** Helper that flattens headers & preserves duplicate objects */
  const orderDupPreservingFlattenedHeaders: (
    { headers: Headers },
  ) => string[] = ({ headers }) => {
    const orderedFlattened = [];
    headers.forEach((value, key) => {
      orderedFlattened.push(`${key}: ${value}`);
    });
    return orderedFlattened;
  };

  describe('headers', () => {
    it('adds headers to the request from the context', async () => {
      expect.assertions(2);

      const headersMiddleware = new ApolloLink((operation, forward) => {
        operation.setContext({
          headers: { authorization: '1234' },
        });
        return forward(operation).map(result => {
          const { headers } = operation.getContext();
          expect(headers).toBeDefined();
          return result;
        });
      });
      const link = ApolloLink.from([
        headersMiddleware,
        new RestLink({ uri: '/api' }),
      ]);

      const post = { id: '1', title: 'Love apollo' };
      fetchMock.get('/api/post/1', post);

      const postTitleQuery = gql`
        query postTitle {
          post(id: "1") @rest(type: "Post", path: "/post/:id") {
            id
            title
          }
        }
      `;

      await makePromise<Result>(
        execute(link, {
          operationName: 'postTitle',
          query: postTitleQuery,
          variables: { id: '1' },
        }),
      );

      const requestCall = fetchMock.calls('/api/post/1')[0];
      expect(orderDupPreservingFlattenedHeaders(requestCall[1])).toEqual([
        'authorization: 1234',
      ]);
    });
    it('adds headers to the request from the setup', async () => {
      const link = new RestLink({
        uri: '/api',
        headers: { authorization: '1234' },
      });

      const post = { id: '1', title: 'Love apollo' };
      fetchMock.get('/api/post/1', post);

      const postTitleQuery = gql`
        query postTitle {
          post(id: "1") @rest(type: "Post", path: "/post/:id") {
            id
            title
          }
        }
      `;

      await makePromise<Result>(
        execute(link, {
          operationName: 'postTitle',
          query: postTitleQuery,
          variables: { id: '1' },
        }),
      );

      const requestCall = fetchMock.calls('/api/post/1')[0];
      expect({ headers: flattenHeaders(requestCall[1]) }).toEqual(
        expect.objectContaining({
          headers: expect.objectContaining({
            authorization: '1234',
          }),
        }),
      );
    });
    it('prioritizes context headers over setup headers', async () => {
      expect.assertions(2);

      const headersMiddleware = new ApolloLink((operation, forward) => {
        operation.setContext({
          headers: {
            authorization: '1234',
            // won't be overridden, will be duplicated because of headersToOverride
            setup: 'in-context duplicate setup',
            context: 'context',
          },
          headersToOverride: ['authorization'],
        });
        return forward(operation).map(result => {
          const { headers } = operation.getContext();
          expect(headers).toBeDefined();
          return result;
        });
      });
      const link = ApolloLink.from([
        headersMiddleware,
        new RestLink({
          uri: '/api',
          headers: { authorization: 'no user', setup: 'setup' },
        }),
      ]);

      const post = { id: '1', title: 'Love apollo' };
      fetchMock.get('/api/post/1', post);

      const postTitleQuery = gql`
        query postTitle {
          post(id: "1") @rest(type: "Post", path: "/post/:id") {
            id
            title
          }
        }
      `;

      await makePromise<Result>(
        execute(link, {
          operationName: 'postTitle',
          query: postTitleQuery,
          variables: { id: '1' },
        }),
      );

      const requestCall = fetchMock.calls('/api/post/1')[0];
      expect(orderDupPreservingFlattenedHeaders(requestCall[1])).toEqual([
        'setup: setup',
        'setup: in-context duplicate setup',
        'authorization: 1234',
        'context: context',
      ]);
    });
    it('respects context-provided header-merge policy', async () => {
      expect.assertions(2);

      const headersMiddleware = new ApolloLink((operation, forward) => {
        /** This Merge Policy preserves the setup headers over the context headers */
        const headersMergePolicy: RestLink.HeadersMergePolicy = (
          ...headerGroups: Headers[]
        ) => {
          return headerGroups.reduce((accumulator, current) => {
            normalizeHeaders(current).forEach((value, key) => {
              if (!accumulator.has(key)) {
                accumulator.append(key, value);
              }
            });
            return accumulator;
          }, new Headers());
        };
        operation.setContext({
          headers: { authorization: 'context', context: 'context' },
          headersMergePolicy,
        });
        return forward(operation).map(result => {
          const { headers } = operation.getContext();
          expect(headers).toBeDefined();
          return result;
        });
      });
      const link = ApolloLink.from([
        headersMiddleware,
        new RestLink({
          uri: '/api',
          headers: { authorization: 'initial setup', setup: 'setup' },
        }),
      ]);

      const post = { id: '1', title: 'Love apollo' };
      fetchMock.get('/api/post/1', post);

      const postTitleQuery = gql`
        query postTitle {
          post(id: "1") @rest(type: "Post", path: "/post/:id") {
            id
            title
          }
        }
      `;

      await makePromise<Result>(
        execute(link, {
          operationName: 'postTitle',
          query: postTitleQuery,
          variables: { id: '1' },
        }),
      );

      const requestCall = fetchMock.calls('/api/post/1')[0];
      expect({ headers: flattenHeaders(requestCall[1]) }).toEqual(
        expect.objectContaining({
          headers: expect.objectContaining({
            authorization: 'initial setup',
            setup: 'setup',
            context: 'context',
          }),
        }),
      );
    });
    it('preserves duplicative headers in their correct order', async () => {
      expect.assertions(2);

      const headersMiddleware = new ApolloLink((operation, forward) => {
        operation.setContext({
          headers: { authorization: 'context' },
        });
        return forward(operation).map(result => {
          const { headers } = operation.getContext();
          expect(headers).toBeDefined();
          return result;
        });
      });
      const link = ApolloLink.from([
        headersMiddleware,
        new RestLink({
          uri: '/api',
          headers: { authorization: 'initial setup' },
        }),
      ]);

      const post = { id: '1', title: 'Love apollo' };
      fetchMock.get('/api/post/1', post);

      const postTitleQuery = gql`
        query postTitle {
          post(id: "1") @rest(type: "Post", path: "/post/:id") {
            id
            title
          }
        }
      `;

      await makePromise<Result>(
        execute(link, {
          operationName: 'postTitle',
          query: postTitleQuery,
          variables: { id: '1' },
        }),
      );

      const requestCall = fetchMock.calls('/api/post/1')[0];
      const { headers } = requestCall[1];
      const orderedFlattened = [];
      headers.forEach((value, key) => {
        orderedFlattened.push(`${key}: ${value}`);
      });
      expect(orderedFlattened).toEqual([
        'authorization: initial setup',
        'authorization: context',
      ]);
    });
  });
});

describe('Mutation', () => {
  describe('basic support', () => {
    afterEach(() => {
      fetchMock.restore();
    });
    it('supports POST requests', async () => {
      expect.assertions(2);

      const link = new RestLink({ uri: '/api' });

      // the id in this hash simulates the server *assigning* an id for the new post
      const post = { id: '1', title: 'Love apollo' };
      fetchMock.post('/api/posts/new', post);
      const resultPost = { __typename: 'Post', ...post };

      const createPostMutation = gql`
        fragment PublishablePostInput on REST {
          title: String
        }

        mutation publishPost($input: PublishablePostInput!) {
          publishedPost(input: $input)
            @rest(type: "Post", path: "/posts/new", method: "POST") {
            id
            title
          }
        }
      `;
      const response = await makePromise<Result>(
        execute(link, {
          operationName: 'publishPost',
          query: createPostMutation,
          variables: { input: { title: post.title } },
        }),
      );
      expect(response.data.publishedPost).toEqual(resultPost);

      const requestCall = fetchMock.calls('/api/posts/new')[0];
      expect(requestCall[1]).toEqual(
        expect.objectContaining({ method: 'POST' }),
      );
    });
    it('supports PUT requests', async () => {
      expect.assertions(2);

      const link = new RestLink({ uri: '/api' });

      // the id in this hash simulates the server *assigning* an id for the new post
      const post = { id: '1', title: 'Love apollo' };
      fetchMock.put('/api/posts/1', post);
      const resultPost = { __typename: 'Post', ...post };

      const replacePostMutation = gql`
        fragment ReplaceablePostInput on REST {
          id: ID
          title: String
        }

        mutation changePost($id: ID!, $input: ReplaceablePostInput!) {
          replacedPost(id: $id, input: $input)
            @rest(type: "Post", path: "/posts/:id", method: "PUT") {
            id
            title
          }
        }
      `;
      const response = await makePromise<Result>(
        execute(link, {
          operationName: 'republish',
          query: replacePostMutation,
          variables: { id: post.id, input: post },
        }),
      );
      expect(response.data.replacedPost).toEqual(resultPost);

      const requestCall = fetchMock.calls('/api/posts/1')[0];
      expect(requestCall[1]).toEqual(
        expect.objectContaining({ method: 'PUT' }),
      );
    });
    it('supports PATCH requests', async () => {
      expect.assertions(2);

      const link = new RestLink({ uri: '/api' });

      // the id in this hash simulates the server *assigning* an id for the new post
      const post = { id: '1', title: 'Love apollo', categoryId: 6 };
      fetchMock.patch('/api/posts/1', post);
      const resultPost = { __typename: 'Post', ...post };

      const editPostMutation = gql`
        fragment PartialPostInput on REST {
          id: ID
          title: String
          categoryId: Number
        }

        mutation editPost($id: ID!, $input: PartialPostInput!) {
          editedPost(id: $id, input: $input)
            @rest(type: "Post", path: "/posts/:id", method: "PATCH") {
            id
            title
            categoryId
          }
        }
      `;
      const response = await makePromise<Result>(
        execute(link, {
          operationName: 'editPost',
          query: editPostMutation,
          variables: { id: post.id, input: { categoryId: post.categoryId } },
        }),
      );
      expect(response.data.editedPost).toEqual(resultPost);

      const requestCall = fetchMock.calls('/api/posts/1')[0];
      expect(requestCall[1]).toEqual(
        expect.objectContaining({ method: 'PATCH' }),
      );
    });
    it('supports DELETE requests', async () => {
      expect.assertions(1);

      const link = new RestLink({ uri: '/api' });

      // the id in this hash simulates the server *assigning* an id for the new post
      const post = { id: '1', title: 'Love apollo' };
      fetchMock.delete('/api/posts/1', post);

      const replacePostMutation = gql`
        mutation deletePost($id: ID!) {
          deletePostResponse(id: $id)
            @rest(type: "Post", path: "/posts/:id", method: "DELETE") {
            NoResponse
          }
        }
      `;
      await makePromise<Result>(
        execute(link, {
          operationName: 'deletePost',
          query: replacePostMutation,
          variables: { id: post.id },
        }),
      );

      const requestCall = fetchMock.calls('/api/posts/1')[0];
      expect(requestCall[1]).toEqual(
        expect.objectContaining({ method: 'DELETE' }),
      );
    });
  });

  describe('fieldNameDenormalizer', () => {
    afterEach(() => {
      fetchMock.restore();
    });
    it('corrects names to snake-case for link-level denormalizer', async () => {
      expect.assertions(2);

      const link = new RestLink({
        uri: '/api',
        fieldNameNormalizer: camelCase,
        fieldNameDenormalizer: snake_case,
      });

      // the id in this hash simulates the server *assigning* an id for the new post
      const snakePost = { title_string: 'Love apollo', category_id: 6 };
      const camelPost = { titleString: 'Love apollo', categoryId: 6 };
      fetchMock.post('/api/posts/new', { id: 1, ...snakePost });
      const intermediatePost = snakePost;
      const resultPost = { ...camelPost, id: 1 };

      const createPostMutation = gql`
        fragment PublishablePostInput on REST {
          titleString: String
          categoryId: Number
        }

        mutation publishPost($input: PublishablePostInput!) {
          publishedPost(input: $input)
            @rest(type: "Post", path: "/posts/new", method: "POST") {
            id
            titleString
            categoryId
            # Add Workaround Fields
            title_string
            category_id
          }
        }
      `;
      const response = await makePromise<Result>(
        execute(link, {
          operationName: 'publishPost',
          query: createPostMutation,
          variables: { input: camelPost },
        }),
      );
      expect(response.data.publishedPost).toEqual(resultPost);

      const requestCall = fetchMock.calls('/api/posts/new')[0];
      expect(requestCall[1]).toEqual(
        expect.objectContaining({
          method: 'POST',
          body: expect.objectContaining(intermediatePost),
        }),
      );
    });
    it('corrects names to snake-case for request-level denormalizer', async () => {
      expect.assertions(2);

      const link = new RestLink({
        uri: '/api',
        fieldNameNormalizer: camelCase,
      });

      // the id in this hash simulates the server *assigning* an id for the new post
      const snakePost = { title_string: 'Love apollo', category_id: 6 };
      const camelPost = { titleString: 'Love apollo', categoryId: 6 };
      fetchMock.post('/api/posts/new', { id: 1, ...snakePost });
      const intermediatePost = snakePost;
      const resultPost = { ...camelPost, id: 1 };

      const createPostMutation = gql`
        fragment PublishablePostInput on REST {
          titleString: String
          categoryId: Number
        }

        mutation publishPost($input: PublishablePostInput!) {
          publishedPost(input: $input)
            @rest(
              type: "Post"
              path: "/posts/new"
              method: "POST"
              fieldNameDenormalizer: $requestLevelDenormalizer
            ) {
            id
            titleString
            categoryId
            # Add Workaround Fields
            title_string
            category_id
          }
        }
      `;
      const response = await makePromise<Result>(
        execute(link, {
          operationName: 'publishPost',
          query: createPostMutation,
          variables: { input: camelPost, requestLevelDenormalizer: snake_case },
        }),
      );
      expect(response.data.publishedPost).toEqual(resultPost);

      const requestCall = fetchMock.calls('/api/posts/new')[0];
      expect(requestCall[1]).toEqual(
        expect.objectContaining({
          method: 'POST',
          body: expect.objectContaining(intermediatePost),
        }),
      );
    });
  });
  describe('bodyKey/bodyBuilder', () => {
    afterEach(() => {
      fetchMock.restore();
    });
    it('respects bodyKey for mutations', async () => {
      expect.assertions(2);

      const link = new RestLink({ uri: '/api' });

      // the id in this hash simulates the server *assigning* an id for the new post
      const post = { id: '1', title: 'Love apollo' };
      fetchMock.post('/api/posts/new', post);
      const resultPost = { __typename: 'Post', ...post };

      const createPostMutation = gql`
        fragment PublishablePostInput on REST {
          title: String
        }

        mutation publishPost(
          $someApiWithACustomBodyKey: PublishablePostInput!
        ) {
          publishedPost(someApiWithACustomBodyKey: $someApiWithACustomBodyKey)
            @rest(
              type: "Post"
              path: "/posts/new"
              method: "POST"
              bodyKey: "someApiWithACustomBodyKey"
            ) {
            id
            title
          }
        }
      `;
      const response = await makePromise<Result>(
        execute(link, {
          operationName: 'publishPost',
          query: createPostMutation,
          variables: { someApiWithACustomBodyKey: { title: post.title } },
        }),
      );
      expect(response.data.publishedPost).toEqual(resultPost);

      const requestCall = fetchMock.calls('/api/posts/new')[0];
      expect(requestCall[1]).toEqual(
        expect.objectContaining({ method: 'POST' }),
      );
    });
    it('respects bodyBuilder for mutations', async () => {
      expect.assertions(2);

      const link = new RestLink({ uri: '/api' });

      // the id in this hash simulates the server *assigning* an id for the new post
      const post = { id: '1', title: 'Love apollo' };
      fetchMock.post('/api/posts/new', post);
      const resultPost = { __typename: 'Post', ...post };

      const createPostMutation = gql`
        fragment PublishablePostInput on REST {
          title: String
        }

        mutation publishPost(
          $input: PublishablePostInput!
          $customBuilder: any
        ) {
          publishedPost(input: $input)
            @rest(
              type: "Post"
              path: "/posts/new"
              method: "POST"
              bodyBuilder: $customBuilder
            ) {
            id
            title
          }
        }
      `;
      function fakeEncryption(args) {
        return 'MAGIC_PREFIX' + JSON.stringify(args.input);
      }

      const response = await makePromise<Result>(
        execute(link, {
          operationName: 'publishPost',
          query: createPostMutation,
          variables: {
            input: { title: post.title },
            customBuilder: fakeEncryption,
          },
        }),
      );
      expect(response.data.publishedPost).toEqual(resultPost);

      const requestCall = fetchMock.calls('/api/posts/new')[0];
      expect(requestCall[1]).toEqual(
        expect.objectContaining({
          method: 'POST',
          body: expect.stringMatching(
            fakeEncryption({ input: { title: post.title } }),
          ),
        }),
      );
    });
  });
});

describe('validateRequestMethodForOperationType', () => {
  describe('for operation type "mutation"', () => {
    it('throws because it is not supported yet', () => {
      expect.assertions(2);
      expect(() =>
        validateRequestMethodForOperationType('GET', 'mutation'),
      ).toThrowError('"mutation" operations do not support that HTTP-verb');
      expect(() =>
        validateRequestMethodForOperationType('GIBBERISH', 'mutation'),
      ).toThrowError('"mutation" operations do not support that HTTP-verb');
    });
  });
  describe('for operation type "subscription"', () => {
    it('throws because it is not supported yet', () => {
      expect.assertions(1);
      expect(() =>
        validateRequestMethodForOperationType('GET', 'subscription'),
      ).toThrowError('A "subscription" operation is not supported yet.');
    });
  });
});

describe('export directive', () => {
  afterEach(() => {
    fetchMock.restore();
  });
  it('should throw an error if export is missing', async () => {
    expect.assertions(1);

    const link = new RestLink({ uri: '/api' });

    const post = { id: '1', title: 'Love apollo', tagId: 6 };
    fetchMock.get('/api/post/1', post);

    const postTagWithoutExport = gql`
      query postTitle {
        post(id: "1") @rest(type: "Post", path: "/post/:id") {
          tagId
          title
          tag @rest(type: "Tag", path: "/tag/:tagId") {
            name
          }
        }
      }
    `;

    try {
      await makePromise<Result>(
        execute(link, {
          operationName: 'postTitle',
          query: postTagWithoutExport,
          variables: { id: '1' },
        }),
      );
    } catch (e) {
      expect(e.message).toBe(
        'Missing params to run query, specify it in the query params or use an export directive',
      );
    }
  });
  it('can use a variable from export', async () => {
    expect.assertions(1);

    const link = new RestLink({ uri: '/api' });

    const post = { id: '1', title: 'Love apollo', tagId: 6 };
    fetchMock.get('/api/post/1', post);
    const tag = { name: 'apollo' };
    fetchMock.get('/api/tag/6', tag);

    const postTagExport = gql`
      query postTitle {
        post(id: "1") @rest(type: "Post", path: "/post/:id") {
          tagId @export(as: "tagId")
          title
          tag @rest(type: "Tag", path: "/tag/:tagId") {
            name
          }
        }
      }
    `;

    const { data } = await makePromise(
      execute(link, {
        operationName: 'postTitle',
        query: postTagExport,
        variables: { id: '1' },
      }),
    );

    expect(data.post.tag).toEqual({ ...tag, __typename: 'Tag' });
  });

  it('can use two variables from export', async () => {
    expect.assertions(2);

    const link = new RestLink({ uri: '/api' });

    const post = { id: '1', title: 'Love apollo', tagId: 6, postAuthor: 10 };
    fetchMock.get('/api/post/1', post);
    const tag = { name: 'apollo' };
    fetchMock.get('/api/tag/6', tag);
    const author = { name: 'Sashko' };
    fetchMock.get('/api/users/10', author);

    const postTagExport = gql`
      query postTitle {
        post(id: "1") @rest(type: "Post", path: "/post/:id") {
          tagId @export(as: "tagId")
          postAuthor @export(as: "authorId")
          title
          tag @rest(type: "Tag", path: "/tag/:tagId") {
            name
          }
          author @rest(type: "User", path: "/users/:authorId") {
            name
          }
        }
      }
    `;

    const { data } = await makePromise<Result>(
      execute(link, {
        operationName: 'postTitle',
        query: postTagExport,
        variables: { id: '1' },
      }),
    );

    expect(data.post.tag).toEqual({ ...tag, __typename: 'Tag' });
    expect(data.post.author).toEqual({ ...author, __typename: 'User' });
  });
});

describe('Apollo client integration', () => {
  afterEach(() => {
    fetchMock.restore();
  });

  it('can integrate with apollo client', async () => {
    expect.assertions(1);

    const link = new RestLink({ uri: '/api' });

    const post = { id: '1', title: 'Love apollo' };
    fetchMock.get('/api/post/1', post);

    const postTagExport = gql`
      query {
        post @rest(type: "Post", path: "/post/1") {
          id
          title
        }
      }
    `;

    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link,
    });

    const { data }: { data: any } = await client.query({
      query: postTagExport,
    });

    expect(data.post).toBeDefined();
  });
});
