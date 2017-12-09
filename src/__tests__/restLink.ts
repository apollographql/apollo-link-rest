import { execute, makePromise, ApolloLink } from 'apollo-link';
import gql from 'graphql-tag';
import * as camelCase from 'camelcase';
import * as fetchMock from 'fetch-mock';

import { RestLink } from '../';
import { validateRequestMethodForOperationType } from '../restLink';

describe('Configuration', () => {
  describe('Errors', () => {
    it('throws without any config', () => {
      expect.assertions(3);

      expect(() => {
        new RestLink();
      }).toThrow();
      expect(() => {
        new RestLink({});
      }).toThrow();
      expect(() => {
        new RestLink({ bogus: '' });
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

      const data = await makePromise(
        execute(link, {
          operationName: 'postTitle',
          query: postAndTags,
        }),
      );

      expect(data.post.title).toBeDefined();
      expect(data.post.tags[0].name).toBeDefined();
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

    const data = await makePromise(
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

    const data = await makePromise(
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

    const data = await makePromise(
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

    const data = await makePromise(
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

    const data = await makePromise(
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

    const data = await makePromise(
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

    const data1 = await makePromise(
      execute(link, {
        operationName: 'postTitle1',
        query: postTitleQuery1,
        variables: { id: '1' },
      }),
    );
    const data2 = await makePromise(
      execute(link, {
        operationName: 'postTitle2',
        query: postTitleQuery2,
        variables: { id: '1' },
      }),
    );

    expect(data1.post.title).toBe(postV1.title);
    expect(data2.post.titleText).toBe(postV2.titleText);
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

    const data = await makePromise(
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

    const data = await makePromise(
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

    const data = await makePromise(
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

      await makePromise(
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

      await makePromise(
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

    it('throws if method is not GET', async () => {
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
        await makePromise(
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

      await makePromise(
        execute(link, {
          operationName: 'postTitle',
          query: postTitleQuery,
          variables: { id: '1' },
        }),
      );

      const requestCall = fetchMock.calls('/api/post/1')[0];
      expect(requestCall[1]).toEqual(
        expect.objectContaining({
          headers: expect.objectContaining({
            authorization: '1234',
          }),
        }),
      );
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

      await makePromise(
        execute(link, {
          operationName: 'postTitle',
          query: postTitleQuery,
          variables: { id: '1' },
        }),
      );

      const requestCall = fetchMock.calls('/api/post/1')[0];
      expect(requestCall[1]).toEqual(
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
        new RestLink({ uri: '/api', headers: { authorization: 'no user' } }),
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

      await makePromise(
        execute(link, {
          operationName: 'postTitle',
          query: postTitleQuery,
          variables: { id: '1' },
        }),
      );

      const requestCall = fetchMock.calls('/api/post/1')[0];
      expect(requestCall[1]).toEqual(
        expect.objectContaining({
          headers: expect.objectContaining({
            authorization: '1234',
          }),
        }),
      );
    });
  });
});

describe('validateRequestMethodForOperationType', () => {
  const createRequestParams = (params = {}) => ({
    name: 'post',
    filteredKeys: [],
    endpoint: `/api/post/1`,
    method: 'POST',
    ...params,
  });
  describe('for operation type "mutation"', () => {
    it('throws because it is not supported yet', () => {
      expect.assertions(1);
      expect(() =>
        validateRequestMethodForOperationType(
          [createRequestParams()],
          'mutation',
        ),
      ).toThrowError('A "mutation" operation is not supported yet.');
    });
    describe('export', () => {
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

        const data = await makePromise(
          execute(link, {
            operationName: 'postTitle',
            query: postTagExport,
            variables: { id: '1' },
          }),
        );

        expect(data.post.tag).toEqual({ ...tag, __typename: 'Tag' });
      });
    });
  });
  describe('for operation type "subscription"', () => {
    it('throws because it is not supported yet', () => {
      expect.assertions(1);
      expect(() =>
        validateRequestMethodForOperationType(
          [createRequestParams()],
          'subscription',
        ),
      ).toThrowError('A "subscription" operation is not supported yet.');
    });
    describe('for operation type "mutation"', () => {
      it('throws because it is not supported yet', () => {
        expect.assertions(1);
        expect(() =>
          validateRequestMethodForOperationType('POST', 'mutation'),
        ).toThrowError('A "mutation" operation is not supported yet.');
      });
    });
    describe('for operation type "subscription"', () => {
      it('throws because it is not supported yet', () => {
        expect.assertions(1);
        expect(() =>
          validateRequestMethodForOperationType('POST', 'subscription'),
        ).toThrowError('A "subscription" operation is not supported yet.');
      });
    });
  });
});
