import {
  ApolloClient,
  InMemoryCache,
  ApolloLink,
  HttpLink,
  execute,
  from,
  toPromise,
  gql,
  disableFragmentWarnings,
} from '@apollo/client/core';
import { onError } from '@apollo/link-error';

disableFragmentWarnings();

import * as camelCase from 'camelcase';
const snake_case = require('snake-case');
import * as fetchMock from 'fetch-mock';

import {
  RestLink,
  validateRequestMethodForOperationType,
  normalizeHeaders,
} from '../restLink';

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

const sampleQuery = gql`
  query post {
    post(id: "1") @rest(type: "Post", path: "/post/:id") {
      id
    }
  }
`;

type Result = { [index: string]: any };

describe('Configuration', async () => {
  describe('Errors', async () => {
    afterEach(() => {
      fetchMock.restore();
    });

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

    it('throws if missing both path and pathBuilder', async () => {
      expect.assertions(1);

      const link = new RestLink({ uri: '/api' });
      const post = { id: '1', title: 'Love apollo' };
      fetchMock.get('/api/post/1', post);

      const postTitleQuery = gql`
        query postTitle {
          post @rest(type: "Post") {
            id
            title
          }
        }
      `;

      try {
        await toPromise<Result>(
          execute(link, {
            operationName: 'postTitle',
            query: postTitleQuery,
          }),
        );
      } catch (error) {
        expect(error.message).toBe(
          'One of ("path" | "pathBuilder") must be set in the @rest() directive. This request had neither, please add one',
        );
      }
    });

    it('throws when invalid typePatchers', async () => {
      expect.assertions(4);
      // If using typescript, the typescript compiler protects us against allowing this.
      // but if people use javascript or force it, we want exceptions to be thrown.
      const pretendItsJavascript = (arg: any): any => arg;

      expect(() => {
        new RestLink({
          uri: '/correct',
          typePatcher: pretendItsJavascript(-1),
        });
      }).toThrow();
      expect(() => {
        new RestLink({
          uri: '/correct',
          typePatcher: pretendItsJavascript('fail'),
        });
      }).toThrow();
      expect(() => {
        new RestLink({
          uri: '/correct',
          typePatcher: pretendItsJavascript([]),
        });
      }).toThrow();
      expect(() => {
        new RestLink({
          uri: '/correct',
          typePatcher: pretendItsJavascript({
            key: 'my values are not functions',
          }),
        });
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

  describe('Field name normalizer', async () => {
    afterEach(() => {
      fetchMock.restore();
    });
    it('should apply fieldNameNormalizer if specified', async () => {
      expect.assertions(3);
      const link = new RestLink({
        uri: '/api',
        fieldNameNormalizer: camelCase,
      });
      // "Server" returns TitleCased and snake_cased fields
      // fieldNameNormalizer changes them to camelCase
      const post = { id: '1', Title: 'Love apollo' };
      fetchMock.get('/api/post/1', post);

      const tags = [
        { Name: 'apollo', tag_description: 'once' },
        { Name: 'graphql', tag_description: 'twice' },
      ];
      fetchMock.get('/api/tags', tags);

      const postAndTags = gql`
        query postAndTags {
          post @rest(type: "Post", path: "/post/1") {
            id
            title
            tags @rest(type: "[Tag]", path: "/tags") {
              name
              tagDescription
            }
          }
        }
      `;

      const { data } = await toPromise<Result>(
        execute(link, {
          operationName: 'postTitle',
          query: postAndTags,
        }),
      );

      expect(data.post.title).toBeDefined();
      expect(data.post.tags[0].name).toBeDefined();
      expect(data.post.tags[0].tagDescription).toEqual('once');
    });
    it('should preserve __typename when using fieldNameNormalizer', async () => {
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
            __typename
            id
            title
            tags @rest(type: "[Tag]", path: "/tags") {
              name
            }
          }
        }
      `;

      const { data } = await toPromise<Result>(
        execute(link, {
          operationName: 'postTitle',
          query: postAndTags,
        }),
      );

      expect(data.post.__typename).toBeDefined();
      expect(data.post.__typename).toEqual('Post');
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

      const { data } = await toPromise<Result>(
        execute(link, {
          operationName: 'postTitle',
          query: postTitle,
        }),
      );

      expect(data.post.title).toBe('custom');
    });
  });

  describe('Default endpoint', () => {
    it('should produce a warning if not specified', async () => {
      let warning = '';
      const warn = message => (warning = message);

      console['warn'] = jest.fn(warn);

      new RestLink({
        endpoints: {
          endpointUri: '/api',
        },
      });

      expect(warning).toBe(
        'RestLink configured without a default URI. All @rest(…) directives must provide an endpoint key!',
      );
    });

    it('should not produce a warning when specified', async () => {
      let warning = '';
      const warn = message => (warning = message);

      console['warn'] = jest.fn(warn);

      new RestLink({
        uri: '/api/v1',
        endpoints: {
          endpointUri: '/api/v2',
        },
      });

      expect(warning).toBe('');
    });
  });
});

describe('Complex responses need nested __typename insertions', () => {
  it('can configure typename by providing a custom type-patcher table', async () => {
    expect.assertions(1);

    const patchIfExists = (
      data: any,
      key: string,
      __typename: string,
      patcher: RestLink.FunctionalTypePatcher,
    ) => {
      const value = data[key];
      if (value == null) {
        return {};
      }
      const result = { [key]: patcher(value, __typename, patcher) };
      return result;
    };
    const typePatcher: RestLink.TypePatcherTable = {
      Outer: (
        obj: any,
        outerType: string,
        patchDeeper: RestLink.FunctionalTypePatcher,
      ) => {
        if (obj == null) {
          return obj;
        }

        return {
          ...obj,
          ...patchIfExists(obj, 'inner1', 'Inner1', patchDeeper),
          ...patchIfExists(
            obj,
            'simpleDoubleNesting',
            'SimpleDoubleNesting',
            patchDeeper,
          ),
          ...patchIfExists(obj, 'nestedArrays', 'NestedArrays', patchDeeper),
        };
      },
      Inner1: (
        obj: any,
        outerType: string,
        patchDeeper: RestLink.FunctionalTypePatcher,
      ) => {
        if (obj == null) {
          return obj;
        }
        return {
          ...obj,
          ...patchIfExists(obj, 'reused', 'Reused', patchDeeper),
        };
      },
      SimpleDoubleNesting: (
        obj: any,
        outerType: string,
        patchDeeper: RestLink.FunctionalTypePatcher,
      ) => {
        if (obj == null) {
          return obj;
        }

        return {
          ...obj,
          ...patchIfExists(obj, 'inner1', 'Inner1', patchDeeper),
        };
      },
      NestedArrays: (
        obj: any,
        outerType: string,
        patchDeeper: RestLink.FunctionalTypePatcher,
      ) => {
        if (obj == null) {
          return obj;
        }

        return {
          ...obj,
          ...patchIfExists(
            obj,
            'singlyArray',
            'SinglyNestedArrayEntry',
            patchDeeper,
          ),
          ...patchIfExists(
            obj,
            'doublyNestedArray',
            'DoublyNestedArrayEntry',
            patchDeeper,
          ),
        };
      },
    };

    const link = new RestLink({ uri: '/api', typePatcher });
    const root = {
      id: '1',
      inner1: { data: 'outer.inner1', reused: { id: 1 } },
      simpleDoubleNesting: {
        data: 'dd',
        inner1: { data: 'outer.SDN.inner1', reused: { id: 2 } },
      },
      nestedArrays: {
        unrelatedArray: ['string', 10],
        singlyArray: [{ data: 'entry!' }],
        doublyNestedArray: [[{ data: 'inception.entry!' }]],
      },
    };
    const rootTyped = {
      __typename: 'Outer',
      id: '1',
      inner1: {
        __typename: 'Inner1',
        data: 'outer.inner1',
        reused: { __typename: 'Reused', id: 1 },
      },
      simpleDoubleNesting: {
        __typename: 'SimpleDoubleNesting',
        data: 'dd',
        inner1: {
          __typename: 'Inner1',
          data: 'outer.SDN.inner1',
          reused: { __typename: 'Reused', id: 2 },
        },
      },
      nestedArrays: {
        __typename: 'NestedArrays',
        unrelatedArray: ['string', 10],
        singlyArray: [{ __typename: 'SinglyNestedArrayEntry', data: 'entry!' }],
        doublyNestedArray: [
          [
            {
              __typename: 'DoublyNestedArrayEntry',
              data: 'inception.entry!',
            },
          ],
        ],
      },
    };

    fetchMock.get('/api/outer/1', root);

    const someQuery = gql`
      query someQuery {
        outer @rest(type: "Outer", path: "/outer/1") {
          id
          inner1 {
            data
            reused {
              id
            }
          }
          simpleDoubleNesting {
            data
            inner1 {
              data
              reused {
                id
              }
            }
          }
          nestedArrays {
            unrelatedArray
            singlyArray {
              data
            }
            doublyNestedArray {
              data
            }
          }
        }
      }
    `;

    const { data } = await toPromise<Result>(
      execute(link, {
        operationName: 'someOperation',
        query: someQuery,
      }),
    );

    expect(data).toMatchObject({
      outer: rootTyped,
    });
  });

  it('can configure typename by using @type annotations', async () => {
    expect.assertions(1);

    const link = new RestLink({ uri: '/api' });
    const root = {
      id: '1',
      inner1: { data: 'outer.inner1', reused: { id: 1 } },
      simpleDoubleNesting: {
        data: 'dd',
        inner1: { data: 'outer.SDN.inner1', reused: { id: 2 } },
      },
      nestedArrays: {
        unrelatedArray: ['string', 10],
        singlyArray: [{ data: 'entry!' }],
        doublyNestedArray: [[{ data: 'inception.entry!' }]],
      },
    };
    const rootTyped = {
      __typename: 'Outer',
      id: '1',
      inner1: {
        __typename: 'Inner1',
        data: 'outer.inner1',
        reused: { __typename: 'Reused', id: 1 },
      },
      simpleDoubleNesting: {
        __typename: 'SimpleDoubleNesting',
        data: 'dd',
        inner1: {
          __typename: 'Inner1',
          data: 'outer.SDN.inner1',
          reused: { __typename: 'Reused', id: 2 },
        },
      },
      nestedArrays: {
        __typename: 'NestedArrays',
        unrelatedArray: ['string', 10],
        singlyArray: [{ __typename: 'SinglyNestedArrayEntry', data: 'entry!' }],
        doublyNestedArray: [
          [
            {
              __typename: 'DoublyNestedArrayEntry',
              data: 'inception.entry!',
            },
          ],
        ],
      },
    };

    fetchMock.get('/api/outer/2', root);

    const someQuery = gql`
      query someQuery {
        outer @rest(type: "Outer", path: "/outer/2") {
          id
          inner1 @type(name: "Inner1") {
            data
            reused @type(name: "Reused") {
              id
            }
          }
          simpleDoubleNesting @type(name: "SimpleDoubleNesting") {
            data
            inner1 @type(name: "Inner1") {
              data
              reused @type(name: "Reused") {
                id
              }
            }
          }
          nestedArrays @type(name: "NestedArrays") {
            unrelatedArray
            singlyArray @type(name: "SinglyNestedArrayEntry") {
              data
            }
            doublyNestedArray @type(name: "DoublyNestedArrayEntry") {
              data
            }
          }
        }
      }
    `;

    const { data } = await toPromise<Result>(
      execute(link, {
        operationName: 'someOperation',
        query: someQuery,
      }),
    );

    expect(data).toMatchObject({
      outer: rootTyped,
    });
  });

  it.skip('can configure typename by providing *both* a custom type-patcher table *and* nested @type annotations -- see Issue 112 https://github.com/apollographql/apollo-link-rest/issues/112', async () => {
    expect.assertions(1);

    const patchIfExists = (
      data: any,
      key: string,
      __typename: string,
      patcher: RestLink.FunctionalTypePatcher,
    ) => {
      const value = data[key];
      if (value == null) {
        return {};
      }
      const result = { [key]: patcher(value, __typename, patcher) };
      return result;
    };
    const typePatcher: RestLink.TypePatcherTable = {
      Outer: (
        obj: any,
        outerType: string,
        patchDeeper: RestLink.FunctionalTypePatcher,
      ) => {
        if (obj == null) {
          return obj;
        }

        return {
          ...obj,
          ...patchIfExists(obj, 'inner1', 'Inner1', patchDeeper),
          ...patchIfExists(
            obj,
            'simpleDoubleNesting',
            'SimpleDoubleNesting',
            patchDeeper,
          ),
          ...patchIfExists(obj, 'nestedArrays', 'NestedArrays', patchDeeper),
        };
      },
      Inner1: (
        obj: any,
        outerType: string,
        patchDeeper: RestLink.FunctionalTypePatcher,
      ) => {
        if (obj == null) {
          return obj;
        }
        return {
          ...obj,
          ...patchIfExists(obj, 'reused', 'Reused', patchDeeper),
        };
      },
      SimpleDoubleNesting: (
        obj: any,
        outerType: string,
        patchDeeper: RestLink.FunctionalTypePatcher,
      ) => {
        if (obj == null) {
          return obj;
        }

        return {
          ...obj,
          ...patchIfExists(obj, 'inner1', 'Inner1', patchDeeper),
        };
      },
      NestedArrays: (
        obj: any,
        outerType: string,
        patchDeeper: RestLink.FunctionalTypePatcher,
      ) => {
        if (obj == null) {
          return obj;
        }

        return {
          ...obj,
          ...patchIfExists(
            obj,
            'singlyArray',
            'SinglyNestedArrayEntry',
            patchDeeper,
          ),
          ...patchIfExists(
            obj,
            'doublyNestedArray',
            'DoublyNestedArrayEntry',
            patchDeeper,
          ),
        };
      },
      InnerAnnotated: (
        obj: any,
        outerType: string,
        patchDeeper: RestLink.FunctionalTypePatcher,
      ) => {
        if (obj == null) {
          return obj;
        }
        return {
          ...obj,
          ...patchIfExists(obj, 'reused', 'Reused', patchDeeper),
        };
      },
    };

    const link = new RestLink({ uri: '/api', typePatcher });
    const root = {
      id: '1',
      inner1: { data: 'outer.inner1', reused: { id: 1 } },
      simpleDoubleNesting: {
        data: 'dd',
        inner1: { data: 'outer.SDN.inner1', reused: { id: 2 } },
      },
      simpleDoubleNestingAnnotated: {
        data: 'dd',
        innerAnnotated: { data: 'inner', reused: { id: 3 } },
      },
      nestedArrays: {
        unrelatedArray: ['string', 10],
        singlyArray: [{ data: 'entry!' }],
        doublyNestedArray: [[{ data: 'inception.entry!' }]],
      },
    };
    const rootTyped = {
      __typename: 'Outer',
      id: '1',
      inner1: {
        __typename: 'Inner1',
        data: 'outer.inner1',
        reused: { __typename: 'Reused', id: 1 },
      },
      simpleDoubleNesting: {
        __typename: 'SimpleDoubleNesting',
        data: 'dd',
        inner1: {
          __typename: 'Inner1',
          data: 'outer.SDN.inner1',
          reused: { __typename: 'Reused', id: 2 },
        },
      },
      simpleDoubleNestingAnnotated: {
        __typename: 'SimpleDoubleNestingAnnotated',
        data: 'dd',
        innerAnnotated: {
          __typename: 'InnerAnnotated',
          data: 'inner',
          reused: {
            __typename: 'Reused',
            id: 3,
          },
        },
      },
      nestedArrays: {
        __typename: 'NestedArrays',
        unrelatedArray: ['string', 10],
        singlyArray: [{ __typename: 'SinglyNestedArrayEntry', data: 'entry!' }],
        doublyNestedArray: [
          [
            {
              __typename: 'DoublyNestedArrayEntry',
              data: 'inception.entry!',
            },
          ],
        ],
      },
    };

    fetchMock.get('/api/outer/3', root);

    const someQuery = gql`
      query someQuery {
        outer @rest(type: "Outer", path: "/outer/3") {
          id
          inner1 {
            data
            reused {
              id
            }
          }
          simpleDoubleNesting {
            data
            inner1 {
              data
              reused {
                id
              }
            }
          }
          simpleDoubleNestingAnnotated
            @type(name: "SimpleDoubleNestingAnnotated") {
            data
            innerAnnotated @type(name: "InnerAnnotated") {
              data
              reused {
                id
              }
            }
          }
          nestedArrays {
            unrelatedArray
            singlyArray {
              data
            }
            doublyNestedArray {
              data
            }
          }
        }
      }
    `;

    const { data } = await toPromise<Result>(
      execute(link, {
        operationName: 'someOperation',
        query: someQuery,
      }),
    );

    expect(data).toMatchObject({
      outer: rootTyped,
    });
  });
});

describe('Can customize/parse the response before passing to Apollo', () => {
  afterEach(() => {
    fetchMock.restore();
  });

  const posts = [
    { title: 'Love apollo' },
    { title: 'Respect apollo', meta: { creatorId: 1 } },
  ];

  describe('with root level `responseTransformer`', () => {
    it('handles single record responses', async () => {
      fetchMock.get('/api/posts/1', {
        meta: {},
        post: posts[1],
      });

      const link = new RestLink({
        uri: '/api',
        responseTransformer: async (response, type) => {
          expect(type).toBe('Post');
          const data = await response.json();
          return data.post;
        },
      });
      const restQuery = gql`
        query {
          post @rest(type: "Post", path: "/posts/1") {
            title
            meta
          }
        }
      `;
      const { data: restData } = await toPromise<Result>(
        execute(link, { operationName: 'restQuery', query: restQuery }),
      );
      expect(restData).toEqual({
        post: {
          title: 'Respect apollo',
          meta: { creatorId: 1 },
          __typename: 'Post',
        },
      });
    });

    it('handles multiple record responses', async () => {
      fetchMock.get('/api/posts', {
        meta: {},
        posts,
      });

      const link = new RestLink({
        uri: '/api',
        responseTransformer: async (response, type) => {
          expect(type).toBe('[Post]');
          const data = await response.json();
          return data.posts;
        },
      });
      const restQuery = gql`
        query {
          posts @rest(type: "[Post]", path: "/posts") {
            title
          }
        }
      `;
      const { data: restData } = await toPromise<Result>(
        execute(link, { operationName: 'restQuery', query: restQuery }),
      );
      expect(restData).toEqual({
        posts: [
          { title: 'Love apollo', __typename: 'Post' },
          { title: 'Respect apollo', __typename: 'Post' },
        ],
      });
    });
  });

  describe('with endpoint level `responseTransformer`', () => {
    it('handles single record responses', async done => {
      fetchMock.get('/api/v1/posts/1', {
        meta: {},
        post: posts[1],
      });

      const link = new RestLink({
        // This is purpsefully wrong so that we verify the endpoint one is called
        responseTransformer: () =>
          done.fail('Should have called endpoint.responseTransformer'),
        endpoints: {
          v1: {
            uri: '/api/v1',
            responseTransformer: async (response, type) => {
              expect(type).toBe('Post');
              const data = await response.json();
              return data.post;
            },
          },
        },
      });
      const restQuery = gql`
        query {
          post @rest(type: "Post", path: "/posts/1", endpoint: "v1") {
            title
            meta
          }
        }
      `;
      const { data: restData } = await toPromise<Result>(
        execute(link, { operationName: 'restQuery', query: restQuery }),
      );
      expect(restData).toEqual({
        post: {
          title: 'Respect apollo',
          meta: { creatorId: 1 },
          __typename: 'Post',
        },
      });
      done();
    });

    it('handles multiple record responses', async done => {
      fetchMock.get('/api/v1/posts', {
        meta: {},
        posts,
      });

      const link = new RestLink({
        responseTransformer: () =>
          done.fail('Should have called endpoint.responseTransformer'),
        endpoints: {
          v1: {
            uri: '/api/v1',
            responseTransformer: async (response, type) => {
              expect(type).toBe('[Post]');
              const data = await response.json();
              return data.posts;
            },
          },
        },
      });
      const restQuery = gql`
        query {
          posts @rest(type: "[Post]", path: "/posts", endpoint: "v1") {
            title
          }
        }
      `;
      const { data: restData } = await toPromise<Result>(
        execute(link, { operationName: 'restQuery', query: restQuery }),
      );
      expect(restData).toEqual({
        posts: [
          { title: 'Love apollo', __typename: 'Post' },
          { title: 'Respect apollo', __typename: 'Post' },
        ],
      });
      done();
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

    const { data } = await toPromise<Result>(
      execute(link, {
        operationName: 'postTitle',
        query: postTitleQuery,
      }),
    );

    expect(data).toMatchObject({ post: { ...post, __typename: 'Post' } });
  });
  it('can run a query that returns a scalar (simple types like string, number, boolean) response', async () => {
    expect.assertions(1);

    const link = new RestLink({ uri: '/api' });
    const stringResp = 'SecretString';
    fetchMock.get('/api/config', JSON.stringify(stringResp));

    const serverConfigQuery = gql`
      query config {
        config @rest(type: "String", path: "/config")
      }
    `;

    const { data } = await toPromise<Result>(
      execute(link, {
        operationName: 'serverConfig',
        query: serverConfigQuery,
      }),
    );

    expect(data).toMatchObject({ config: stringResp });
  });

  it('can run a query that returns an array of scalars', async () => {
    expect.assertions(1);

    const link = new RestLink({ uri: '/api' });

    const arrayResp = ['Id1', 'Id2'];
    fetchMock.get('/api/admins', JSON.stringify(arrayResp));
    const adminsQuery = gql`
      query adminIds {
        admins @rest(type: "[String!]!", path: "/admins")
      }
    `;
    const { data } = await toPromise<Result>(
      execute(link, {
        operationName: 'adminIds',
        query: adminsQuery,
      }),
    );

    expect(data).toMatchObject({ admins: arrayResp });
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

    const { data } = await toPromise<Result>(
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

    // Verify multidimensional array support: https://github.com/apollographql/apollo-client/issues/776
    const keywordGroups = [
      [{ name: 'group1.element1' }, { name: 'group1.element2' }],
      [
        { name: 'group2.element1' },
        { name: 'group2.element2' },
        { name: 'group2.element3' },
      ],
    ];
    fetchMock.get('/api/keywordGroups', keywordGroups);

    const tagsQuery = gql`
      query tags {
        tags @rest(type: "[Tag]", path: "/tags") {
          name
        }
        keywordGroups @rest(type: "[ [ Keyword ] ]", path: "/keywordGroups") {
          name
        }
      }
    `;

    const { data } = await toPromise<Result>(
      execute(link, {
        operationName: 'tags',
        query: tagsQuery,
      }),
    );

    const tagsWithTypeName = tags.map(tag => ({
      ...tag,
      __typename: 'Tag',
    }));
    const keywordGroupsWithTypeName = keywordGroups.map(kg =>
      kg.map(element => ({ ...element, __typename: 'Keyword' })),
    );
    expect(data).toMatchObject({
      tags: tagsWithTypeName,
      keywordGroups: keywordGroupsWithTypeName,
    });
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

    const { data } = await toPromise<Result>(
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

    const { data } = await toPromise<Result>(
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
        post(id: $id) @rest(type: "Post", path: "/post/:id") {
          id
          title
        }
      }
    `;

    const { data } = await toPromise<Result>(
      execute(link, {
        operationName: 'postTitle',
        query: postTitleQuery,
        variables: { id: '1' },
      }),
    );

    expect(data.post.title).toBe(post.title);
  });

  it('can pass param with `0` value to a query with a variable', async () => {
    expect.assertions(1);

    const link = new RestLink({ uri: '/api' });

    const post = { id: '1', title: 'Love apollo' };
    fetchMock.get('/api/feed?offset=0', post);

    const feedQuery = gql`
      query feed {
        post(offset: $offset)
          @rest(type: "Post", path: "/feed?offset=:offset") {
          id
          title
        }
      }
    `;

    const { data } = await toPromise<Result>(
      execute(link, {
        operationName: 'feed',
        query: feedQuery,
        variables: { offset: 0 },
      }),
    );

    expect(data.post.title).toBe(post.title);
  });

  it('can pass param with `false` value to a query with a variable', async () => {
    expect.assertions(1);

    const link = new RestLink({ uri: '/api' });

    const post = { id: '1', title: 'Love apollo' };
    fetchMock.get('/api/feed?published=false', post);

    const feedQuery = gql`
      query feed {
        post(published: $published)
          @rest(type: "Post", path: "/feed?published=:published") {
          id
          title
        }
      }
    `;

    const { data } = await toPromise<Result>(
      execute(link, {
        operationName: 'feed',
        query: feedQuery,
        variables: { published: false },
      }),
    );

    expect(data.post.title).toBe(post.title);
  });

  it('can pass param with `null` value to a query with a variable', async () => {
    expect.assertions(1);

    const link = new RestLink({ uri: '/api' });

    const person = { name: 'John' };
    fetchMock.get('/api/people?address=null', person);

    const peopleWithoutAddressQuery = gql`
      query feed {
        people(address: $address)
          @rest(type: "Person", path: "/people?address=:address") {
          name
        }
      }
    `;

    const { data } = await toPromise<Result>(
      execute(link, {
        operationName: 'feed',
        query: peopleWithoutAddressQuery,
        variables: { address: null },
      }),
    );

    expect(data.people.name).toBe(person.name);
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

    const { data: data1 } = await toPromise<Result>(
      execute(link, {
        operationName: 'postTitle1',
        query: postTitleQuery1,
        variables: { id: '1' },
      }),
    );
    const { data: data2 } = await toPromise<Result>(
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

    const { data } = await toPromise<Result>(
      execute(link, {
        operationName: 'postTitle',
        query: postTitleQuery,
      }),
    );

    expect(data).toMatchObject({
      post: { ...postWithNest, __typename: 'Post' },
    });
  });

  it('returns an empty object on 204 status', async () => {
    expect.assertions(1);

    const link = new RestLink({ uri: '/api' });

    fetchMock.get('/api/no-content', {
      headers: { 'Content-Length': 0 },
      status: 204,
      body: { hasNoContent: true },
    });

    const queryWithNoContent = gql`
      query noContent {
        noContentResponse @rest(type: "NoContent", path: "/no-content") {
          hasNoContent
        }
      }
    `;

    const { data } = await toPromise<Result>(
      execute(link, {
        operationName: 'noContent',
        query: queryWithNoContent,
      }),
    );

    expect(data).toMatchObject({
      noContentResponse: {
        __typename: 'NoContent',
        hasNoContent: null,
      },
    });
  });

  it('returns an error on unsuccessful gets with zero Content-Length', async () => {
    expect.assertions(1);

    const link = new RestLink({ uri: '/api' });

    fetchMock.get('/api/no-content', {
      headers: { 'Content-Length': 0 },
      status: 400,
      body: { hasNoContent: true },
    });

    const errorWithNoContent = gql`
      query noContent {
        noContentResponse @rest(type: "NoContent", path: "/no-content") {
          hasNoContent
        }
      }
    `;

    try {
      await toPromise<Result>(
        execute(link, {
          operationName: 'noContent',
          query: errorWithNoContent,
        }),
      );
    } catch (e) {
      expect(e).toEqual(
        new Error('Response not successful: Received status code 400'),
      );
    }
  });
});

describe('Use a custom pathBuilder', () => {
  afterEach(() => {
    fetchMock.restore();
  });
  it('in a basic way', async () => {
    expect.assertions(4);

    const link = new RestLink({ uri: '/api' });
    const posts1 = [{ id: '1', title: 'Love apollo' }];
    const posts2 = [{ id: '2', title: 'Love apollo' }];
    fetchMock.get('/api/posts?status=published', posts1);
    fetchMock.get('/api/posts?otherStatus=published', posts2);

    const postTitleQuery = gql`
      query postTitle(
        $pathFunction: any
        $status: String
        $otherStatus: String
      ) {
        posts(status: $status, otherStatus: $otherStatus)
          @rest(type: "Post", pathBuilder: $pathFunction) {
          id
          title
        }
      }
    `;

    function createPostsPath({
      args,
      exportVariables,
    }: RestLink.PathBuilderProps) {
      const variables = { ...args, ...exportVariables };
      const qs = Object.keys(variables).reduce(
        (acc: string, key: string): string => {
          if (variables[key] === null || variables[key] === undefined) {
            return acc;
          }
          if (acc === '') {
            return '?' + key + '=' + encodeURIComponent(String(variables[key]));
          }
          return (
            acc + '&' + key + '=' + encodeURIComponent(String(variables[key]))
          );
        },
        '',
      );

      // console.debug(variables, qs);
      return '/posts' + qs;
    }

    const { data: data1 } = await toPromise<Result>(
      execute(link, {
        operationName: 'postTitle',
        query: postTitleQuery,
        variables: {
          status: 'published',
          pathFunction: createPostsPath,
        },
      }),
    );

    expect(data1).toMatchObject({
      posts: [{ ...posts1[0], __typename: 'Post' }],
    });

    // Extra tests below to disprove: https://github.com/apollographql/apollo-link-rest/issues/102
    const { data: data2 } = await toPromise<Result>(
      execute(link, {
        operationName: 'postTitle',
        query: postTitleQuery,
        variables: {
          otherStatus: 'published',
          pathFunction: createPostsPath,
        },
      }),
    );

    expect(data2).toMatchObject({
      posts: [{ ...posts2[0], __typename: 'Post' }],
    });

    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link,
    });

    const { data: data1b }: { data: any } = await client.query({
      query: postTitleQuery,
      variables: {
        status: 'published',
        pathFunction: createPostsPath,
      },
    });
    expect(data1b).toMatchObject({
      posts: [{ ...posts1[0], __typename: 'Post' }],
    });

    const { data: data2b }: { data: any } = await client.query({
      query: postTitleQuery,
      variables: {
        otherStatus: 'published',
        pathFunction: createPostsPath,
      },
    });
    expect(data2b).toMatchObject({
      posts: [{ ...posts2[0], __typename: 'Post' }],
    });
  });

  it('with correctly encoded params', async () => {
    // expect.assertions(4);

    const link = new RestLink({ uri: '/api' });
    const posts1 = [{ id: '1', title: 'Love apollo' }];
    // This is an invalid URL because it doesn't have an encoded space, this is to prove
    // we didn't encode it if it wasn't prefixed by '?' or '&' ?{args} or &{args}
    fetchMock.get('/api/posts?name=Love apollo', posts1);
    // This URL is legacy (shouldn't be called)
    fetchMock.get('/api/posts?name=Love+apollo', posts1);
    // This URL is correctly encoded
    fetchMock.get('/api/posts?name=Love%20apollo', posts1);
    // Uses a query string & a path replacement
    fetchMock.get('/api/posts/1?comments=5', posts1);

    const nonEncodedQuery = gql`
      query postQuery($name: String) {
        posts(name: $name)
          @rest(type: "Post", path: "/posts?name={args.name}") {
          id
          title
        }
      }
    `;
    const encodedQuery = gql`
      query postQuery($name: String) {
        posts(name: $name) @rest(type: "Post", path: "/posts?{args}") {
          id
          title
        }
      }
    `;
    const mixedQuery = gql`
      query postQuery($id: String, $query: Any) {
        posts(id: $id, query: $query)
          @rest(type: "Post", path: "/posts/{args.id}?{args.query}") {
          id
          title
        }
      }
    `;

    await toPromise<Result>(
      execute(link, {
        operationName: 'postQuery',
        query: nonEncodedQuery,
        variables: { name: 'Love apollo' },
      }),
    );

    expect(fetchMock.called('/api/posts?name=Love apollo')).toBe(true);

    await toPromise<Result>(
      execute(link, {
        operationName: 'postQuery',
        query: encodedQuery,
        variables: { name: 'Love apollo' },
      }),
    );

    expect(fetchMock.called('/api/posts?name=Love%20apollo')).toBe(true);

    await toPromise<Result>(
      execute(link, {
        operationName: 'postQuery',
        query: mixedQuery,
        variables: { id: 1, query: { comments: 5 } },
      }),
    );

    expect(fetchMock.called('/api/posts/1?comments=5')).toBe(true);
  });
  // TODO: Test for Path using context
  // TODO: Test for PathBuilder using replacer
  // TODO: Test for PathBuilder using @rest
});

describe('Query multiple calls', () => {
  afterEach(() => {
    fetchMock.restore();
  });

  it('can run a query with multiple rest calls', async () => {
    expect.assertions(2);

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

    const { data } = await toPromise<Result>(
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

    const { data } = await toPromise<Result>(
      execute(link, {
        operationName: 'postAndTags',
        query: postAndTags,
      }),
    );

    expect(data.post).toBeDefined();
    expect(data.post.tags).toBeDefined();
  });
});

describe('GraphQL aliases should work', async () => {
  afterEach(() => {
    fetchMock.restore();
  });

  it('outer-level aliases are supported', async () => {
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

    const { data } = await toPromise<Result>(
      execute(link, {
        operationName: 'postTitle',
        query: postTitleQueries,
        variables: { id: '1' },
      }),
    );

    expect(data.v1.title).toBe(postV1.title);
    expect(data.v2.titleText).toBe(postV2.titleText);
  });

  it('nested aliases are supported', async () => {
    expect.assertions(1);

    const link = new RestLink({ uri: '/v1' });

    const postV1 = { id: '1', titleText: '1. Love apollo' };
    fetchMock.get('/v1/post/1', postV1);

    const postTitleQueries = gql`
      query postTitle($id: ID!) {
        post(id: $id) @rest(type: "Post", path: "/post/:id") {
          id
          title: titleText
        }
      }
    `;

    const { data } = await toPromise<Result>(
      execute(link, {
        operationName: 'postTitle',
        query: postTitleQueries,
        variables: { id: '1' },
      }),
    );

    expect(data.post.title).toBe(postV1.titleText);
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

      await toPromise<Result>(
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

      await toPromise<Result>(
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

      await toPromise<Result>(
        execute(link, {
          operationName: 'post',
          query: sampleQuery,
        }),
      );

      const credentials = fetchMock.lastCall()[1].credentials;
      expect(credentials).toBe('my-credentials');
    });

    it('sets the fetch responses on context.restResponses', async () => {
      expect.assertions(5);

      const credentialsMiddleware = new ApolloLink((operation, forward) => {
        return forward(operation).map(result => {
          const { restResponses } = operation.getContext();
          expect(restResponses).toHaveLength(2);
          expect(restResponses[0].url).toBe('/api/post/1');
          expect(restResponses[0].headers.get('Header1')).toBe('Header1');
          expect(restResponses[1].url).toBe('/api/tags');
          expect(restResponses[1].headers.get('Header2')).toBe('Header2');
          return result;
        });
      });

      const link = ApolloLink.from([
        credentialsMiddleware,
        new RestLink({ uri: '/api' }),
      ]);

      const context: { restResponses?: Response[] } = {};

      const post = { id: '1', title: 'Love apollo' };
      fetchMock.get('/api/post/1', {
        body: post,
        headers: { Header1: 'Header1' },
      });

      const tags = [{ name: 'apollo' }, { name: 'graphql' }];
      fetchMock.get('/api/tags', {
        body: tags,
        headers: { Header2: 'Header2' },
      });

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

      await toPromise<Result>(
        execute(link, {
          operationName: 'postAndTags',
          query: postAndTags,
          context,
        }),
      );
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

      await toPromise<Result>(
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

      await toPromise<Result>(
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
  });

  describe('headers', () => {
    it('sets the Accept: application/json header if not provided', async () => {
      expect.assertions(2);

      fetchMock.get('/api/posts', []);
      const postsQuery = gql`
        query posts {
          posts @rest(type: "Post", path: "/posts") {
            id
          }
        }
      `;
      const operation = {
        operationName: 'posts',
        query: postsQuery,
      };

      const link1 = new RestLink({ uri: '/api' });
      await toPromise<Result>(execute(link1, operation));

      const link2 = new RestLink({
        uri: '/api',
        headers: {
          Accept: 'text/plain',
        },
      });
      await toPromise<Result>(execute(link2, operation));

      const requestCalls = fetchMock.calls('/api/posts');
      expect(orderDupPreservingFlattenedHeaders(requestCalls[0][1])).toEqual([
        'accept: application/json',
      ]);
      expect(orderDupPreservingFlattenedHeaders(requestCalls[1][1])).toEqual([
        'accept: text/plain',
      ]);
    });
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

      await toPromise<Result>(
        execute(link, {
          operationName: 'postTitle',
          query: postTitleQuery,
          variables: { id: '1' },
        }),
      );

      const requestCall = fetchMock.calls('/api/post/1')[0];
      expect(orderDupPreservingFlattenedHeaders(requestCall[1])).toEqual([
        'accept: application/json',
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

      await toPromise<Result>(
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

      await toPromise<Result>(
        execute(link, {
          operationName: 'postTitle',
          query: postTitleQuery,
          variables: { id: '1' },
        }),
      );

      const requestCall = fetchMock.calls('/api/post/1')[0];
      expect(orderDupPreservingFlattenedHeaders(requestCall[1])).toEqual([
        'accept: application/json',
        'authorization: 1234',
        'context: context',
        'setup: setup, in-context duplicate setup',
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

      await toPromise<Result>(
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

      await toPromise<Result>(
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
        'accept: application/json',
        'authorization: initial setup, context',
      ]);
    });
    it('generates a new headers object if headers are undefined', async () => {
      const headersMiddleware = new ApolloLink((operation, forward) => {
        operation.setContext({
          headers: undefined,
        });
        return forward(operation).map(result => {
          const { headers } = operation.getContext();
          expect(headers).toBeUndefined();
          return result;
        });
      });
      const link = ApolloLink.from([
        headersMiddleware,
        new RestLink({ uri: '/api', headers: undefined }),
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

      await toPromise<Result>(
        execute(link, {
          operationName: 'postTitle',
          query: postTitleQuery,
          variables: { id: '1' },
        }),
      );

      const requestCall = fetchMock.calls('/api/post/1')[0];
      expect(orderDupPreservingFlattenedHeaders(requestCall[1])).toEqual([
        'accept: application/json',
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
      const response = await toPromise<Result>(
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
      const response = await toPromise<Result>(
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
      const response = await toPromise<Result>(
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
      await toPromise<Result>(
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

  describe('empty response bodies', () => {
    afterEach(() => {
      fetchMock.restore();
    });

    it('returns an empty object on 204 status', async () => {
      // In truth this test is just for show, because the fetch implementation
      // used in the tests already returns {} from res.json() for 204 responses
      expect.assertions(1);

      const link = new RestLink({ uri: '/api' });

      const post = { id: '1', title: 'Love apollo' };
      fetchMock.post('/api/posts', {
        status: 204,
        body: post,
      });

      const createPostMutation = gql`
        fragment PublishablePostInput on REST {
          title: String
        }

        mutation publishPost($input: PublishablePostInput!) {
          publishedPost(input: $input)
            @rest(type: "Post", path: "/posts", method: "POST") {
            id
            title
          }
        }
      `;
      const response = await toPromise<Result>(
        execute(link, {
          operationName: 'publishPost',
          query: createPostMutation,
          variables: { input: { title: post.title } },
        }),
      );

      expect(response.data.publishedPost).toEqual({
        __typename: 'Post',
        id: null,
        title: null,
      });
    });

    it('returns an empty object on successful posts with zero Content-Length', async () => {
      // In Node.js parsing an empty body doesn't throw an error, so the best test is
      // to provide body data and ensure the zero length still triggers the empty response
      expect.assertions(1);

      const link = new RestLink({ uri: '/api' });
      const post = { id: '1', title: 'Love apollo' };

      fetchMock.post('/api/posts', {
        headers: { 'Content-Length': 0 },
        body: post,
      });

      const createPostMutation = gql`
        fragment PublishablePostInput on REST {
          title: String
        }

        mutation publishPost($input: PublishablePostInput!) {
          publishedPost(input: $input)
            @rest(type: "Post", path: "/posts", method: "POST") {
            id
            title
          }
        }
      `;

      const response = await toPromise<Result>(
        execute(link, {
          operationName: 'publishPost',
          query: createPostMutation,
          variables: { input: { title: post.title } },
        }),
      );

      expect(response.data.publishedPost).toEqual({
        __typename: 'Post',
        id: null,
        title: null,
      });
    });

    it('returns an error on unsuccessful posts with zero Content-Length', async () => {
      expect.assertions(1);

      const link = new RestLink({ uri: '/api' });

      fetchMock.post('/api/posts', {
        headers: { 'Content-Length': 0 },
        status: 400,
      });

      const createPostMutation = gql`
        fragment PublishablePostInput on REST {
          title: String
        }

        mutation publishPost($input: PublishablePostInput!) {
          publishedPost(input: $input)
            @rest(type: "Post", path: "/posts", method: "POST") {
            title
          }
        }
      `;

      try {
        await toPromise<Result>(
          execute(link, {
            operationName: 'publishPost',
            query: createPostMutation,
            variables: { input: { title: null } },
          }),
        );
      } catch (e) {
        expect(e).toEqual(
          new Error('Response not successful: Received status code 400'),
        );
      }
    });
  });

  it('returns an error on zero Content-Length but status > 300', async () => {
    expect.assertions(1);

    const link = new RestLink({ uri: '/api' });

    const post = { id: '1', title: 'Love apollo' };
    fetchMock.post('/api/posts', {
      headers: { 'Content-Length': 0 },
      status: 500,
      body: post,
    });

    const createPostMutation = gql`
      fragment PublishablePostInput on REST {
        title: String
      }

      mutation publishPost($input: PublishablePostInput!) {
        publishedPost(input: $input)
          @rest(type: "Post", path: "/posts", method: "POST") {
          id
          title
        }
      }
    `;
    return await toPromise<Result>(
      execute(link, {
        operationName: 'publishPost',
        query: createPostMutation,
        variables: { input: { title: post.title } },
      }),
    ).catch(e =>
      expect(e).toEqual(
        new Error('Response not successful: Received status code 500'),
      ),
    );
  });

  describe('fieldNameDenormalizer', () => {
    afterEach(() => {
      fetchMock.restore();
    });
    it('corrects names to snake_case for link-level denormalizer', async () => {
      expect.assertions(3);

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
          }
        }
      `;
      const response = await toPromise<Result>(
        execute(link, {
          operationName: 'publishPost',
          query: createPostMutation,
          variables: { input: camelPost },
        }),
      );

      const requestCall = fetchMock.calls('/api/posts/new')[0];

      expect(requestCall[1]).toEqual(
        expect.objectContaining({
          method: 'POST',
        }),
      );
      expect(JSON.parse(requestCall[1].body)).toMatchObject(intermediatePost);

      expect(response.data.publishedPost).toEqual(
        expect.objectContaining(resultPost),
      );
    });
    it('corrects names to snake_case for request-level denormalizer', async () => {
      expect.assertions(3);

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
          categoryId: Int
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
          }
        }
      `;
      const response = await toPromise<Result>(
        execute(link, {
          operationName: 'publishPost',
          query: createPostMutation,
          variables: { input: camelPost, requestLevelDenormalizer: snake_case },
        }),
      );

      const requestCall = fetchMock.calls('/api/posts/new')[0];

      expect(requestCall[1]).toEqual(
        expect.objectContaining({
          method: 'POST',
        }),
      );
      expect(JSON.parse(requestCall[1].body)).toMatchObject(intermediatePost);

      expect(response.data.publishedPost).toEqual(
        expect.objectContaining(resultPost),
      );
    });
  });
  describe('bodyKey/bodyBuilder', () => {
    afterEach(() => {
      fetchMock.restore();
    });
    it("if using the regular JSON bodyBuilder it doesn't stack multiple content-type headers", async () => {
      const CUSTOM_JSON_CONTENT_TYPE = 'my-custom-json-ish-content-type';

      const link = new RestLink({
        uri: '/api',
        headers: { 'Content-Type': CUSTOM_JSON_CONTENT_TYPE },
      });
      const post = {
        id: '1',
        title: 'Love apollo',
        items: [{ name: 'first' }, { name: 'second' }],
      };

      fetchMock.post('/api/posts/newComplexPost', post);

      const createPostMutation = gql`
        fragment Item on any {
          name: String
        }

        fragment PublishablePostInput on REST {
          id: String
          title: String
          items {
            ...Item
          }
        }

        mutation publishPost($input: PublishablePostInput!) {
          publishedPost(input: $input)
            @rest(type: "Post", path: "/posts/newComplexPost", method: "POST") {
            id
            title
            items
          }
        }
      `;

      await toPromise<Result>(
        execute(link, {
          operationName: 'publishPost',
          query: createPostMutation,
          variables: { input: post },
        }),
      );
      const requestCall = fetchMock.calls('/api/posts/newComplexPost')[0];
      expect(requestCall[1].headers.get('content-type')).toEqual(
        CUSTOM_JSON_CONTENT_TYPE,
      );
    });
    it('builds request body containing Strings/Objects/Arrays types without changing their types', async () => {
      // tests convertObjectKeys functionality
      // see: https://github.com/apollographql/apollo-link-rest/issues/45
      expect.assertions(3);

      const link = new RestLink({ uri: '/api' });

      //body containing Primitives, Objects and Arrays types
      const post = {
        id: '1',
        title: 'Love apollo',
        items: [{ name: 'first' }, { name: 'second' }],
      };

      fetchMock.post('/api/posts/newComplexPost', post);
      const resultPost = { __typename: 'Post', ...post };

      const createPostMutation = gql`
        fragment Item on any {
          name: String
        }

        fragment PublishablePostInput on REST {
          id: String
          title: String
          items {
            ...Item
          }
        }

        mutation publishPost($input: PublishablePostInput!) {
          publishedPost(input: $input)
            @rest(type: "Post", path: "/posts/newComplexPost", method: "POST") {
            id
            title
            items
          }
        }
      `;

      const response = await toPromise<Result>(
        execute(link, {
          operationName: 'publishPost',
          query: createPostMutation,
          variables: { input: post },
        }),
      );
      expect(response.data.publishedPost).toEqual(resultPost);

      const requestCall = fetchMock.calls('/api/posts/newComplexPost')[0];
      expect(requestCall[1]).toEqual(
        expect.objectContaining({ method: 'POST' }),
      );
      expect(requestCall[1].body).toEqual(JSON.stringify(post));
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
      const response = await toPromise<Result>(
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
      function fakeEncryption({ args }: RestLink.RestLinkHelperProps) {
        return 'MAGIC_PREFIX' + JSON.stringify(args.input);
      }

      const response = await toPromise<Result>(
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
          body: JSON.stringify(
            fakeEncryption({
              args: { input: { title: post.title } },
              exportVariables: {},
              context: {},
              '@rest': {},
            }),
          ),
        }),
      );
    });
    it('builds a request body for query operations', async () => {
      expect.assertions(3);

      const link = new RestLink({ uri: '/api' });
      const post = { id: '1', title: 'This does not feel very RESTful.' };
      const resultPost = { __typename: 'Post', ...post };
      fetchMock.post('/api/post-to-get-post', post);

      const getPostQuery = gql`
        query getPost($id: ID!) {
          post(input: { id: $id })
            @rest(type: "Post", path: "/post-to-get-post", method: "POST") {
            id
            title
          }
        }
      `;

      const response = await toPromise<Result>(
        execute(link, {
          operationName: 'getPost',
          query: getPostQuery,
          variables: { id: '1' },
        }),
      );

      expect(response.data.post).toEqual(resultPost);

      const requestCall = fetchMock.calls('/api/post-to-get-post')[0];
      expect(requestCall[1]).toEqual(
        expect.objectContaining({ method: 'POST' }),
      );
      expect(requestCall[1].body).toEqual(JSON.stringify({ id: '1' }));
    });
    it('throws when no body input is provided for HTTP methods other than GET or DELETE', async () => {
      expect.assertions(1);

      const link = new RestLink({ uri: '/api' });

      const createPostMutation = gql`
        mutation createPost {
          sendPost @rest(type: "Post", path: "/posts/new", method: "POST") {
            id
            title
          }
        }
      `;

      await toPromise<Result>(
        execute(link, {
          operationName: 'createPost',
          query: createPostMutation,
        }),
      ).catch(e =>
        expect(e).toEqual(
          new Error(
            '[GraphQL POST mutation using a REST call without a body]. No `input` was detected. Pass bodyKey, or bodyBuilder to the @rest() directive to resolve this.',
          ),
        ),
      );
    });
    // TODO: Test for BodyBuilder using context
    // TODO: Test for BodyBuilder using @rest
  });

  describe('bodySerializer', () => {
    afterEach(() => {
      fetchMock.restore();
    });

    it('defaults to json serialization for objects', async () => {
      expect.assertions(2);

      const link = new RestLink({ uri: '/api' });

      //body containing Primitives, Objects and Arrays types
      const post = {
        id: '1',
        title: 'Love apollo',
        items: [{ name: 'first' }, { name: 'second' }],
      };

      fetchMock.post('/api/posts/newComplexPost', post);

      const createPostMutation = gql`
        fragment Item on any {
          name: String
        }

        fragment PublishablePostInput on REST {
          id: String
          title: String
          items {
            ...Item
          }
        }

        mutation publishPost($input: PublishablePostInput!) {
          publishedPost(input: $input)
            @rest(type: "Post", path: "/posts/newComplexPost", method: "POST") {
            id
            title
            items
          }
        }
      `;

      await toPromise<Result>(
        execute(link, {
          operationName: 'publishPost',
          query: createPostMutation,
          variables: { input: post },
        }),
      );

      const requestCall = fetchMock.calls('/api/posts/newComplexPost')[0];
      expect(requestCall[1]).toEqual(
        expect.objectContaining({ method: 'POST' }),
      );
      expect(requestCall[1].body).toEqual(JSON.stringify(post));
    });

    it('respects custom body serializers keys', async () => {
      expect.assertions(3);

      // A custom serializer that always returns the same value
      const constSerializer = () => ({
        body: 42,
        headers: { 'Content-Type': 'text/plain' },
      });

      const link = new RestLink({
        uri: '/api',
        bodySerializers: {
          const: constSerializer,
        },
      });

      //body containing Primitives, Objects and Arrays types
      const post = {
        id: '1',
        title: 'Love apollo',
        items: [{ name: 'first' }, { name: 'second' }],
      };

      fetchMock.post('/api/posts/newComplexPost', post);

      const createPostMutation = gql`
        fragment Item on any {
          name: String
        }

        fragment PublishablePostInput on REST {
          id: String
          title: String
          items {
            ...Item
          }
        }

        mutation publishPost(
          $input: PublishablePostInput!
          $bodySerializer: any
        ) {
          publishedPost(input: $input)
            @rest(
              type: "Post"
              path: "/posts/newComplexPost"
              method: "POST"
              bodySerializer: "const"
            ) {
            id
            title
            items
          }
        }
      `;

      await toPromise<Result>(
        execute(link, {
          operationName: 'publishPost',
          query: createPostMutation,
          variables: { input: post },
        }),
      );

      const requestCall = fetchMock.calls('/api/posts/newComplexPost')[0];
      expect(requestCall[1]).toEqual(
        expect.objectContaining({ method: 'POST' }),
      );
      expect(requestCall[1].body).toEqual(42);
      expect({ headers: flattenHeaders(requestCall[1]) }).toEqual(
        expect.objectContaining({
          headers: expect.objectContaining({
            'content-type': 'text/plain',
          }),
        }),
      );
    });

    it('respects custom body serializers', async () => {
      expect.assertions(4);

      // A custom serializer that always returns the same value
      const constSerializer = (_, headers) => ({ body: 42, headers });

      const link = new RestLink({
        uri: '/api',
        bodySerializers: {
          fake: (data, headers) => ({
            body: { ...data, isFake: true },
            headers,
          }),
        },
      });

      //body containing Primitives, Objects and Arrays types
      const post = {
        id: '1',
        title: 'Love apollo',
        items: [{ name: 'first' }, { name: 'second' }],
      };

      fetchMock.post('/api/posts/newComplexPost', post);

      const createPostMutation = gql`
        fragment Item on any {
          name: String
        }

        fragment PublishablePostInput on REST {
          id: String
          title: String
          items {
            ...Item
          }
        }

        mutation publishPost(
          $input: PublishablePostInput!
          $bodySerializer: any
        ) {
          publishedPost(input: $input)
            @rest(
              type: "Post"
              path: "/posts/newComplexPost"
              method: "POST"
              bodySerializer: $bodySerializer
            ) {
            id
            title
            items
          }
          fakePublishedPost: publishedPost(input: $input)
            @rest(
              type: "Post"
              path: "/posts/newComplexPost"
              method: "POST"
              bodySerializer: "fake"
            ) {
            id
            title
            items
          }
        }
      `;

      await toPromise<Result>(
        execute(link, {
          operationName: 'publishPost',
          query: createPostMutation,
          variables: { input: post, bodySerializer: constSerializer },
        }),
      );

      const requestCall = fetchMock.calls('/api/posts/newComplexPost')[0];
      expect(requestCall[1]).toEqual(
        expect.objectContaining({ method: 'POST' }),
      );
      expect(requestCall[1].body).toEqual(42);

      const secondRequestCall = fetchMock.calls('/api/posts/newComplexPost')[1];
      expect(secondRequestCall[1]).toEqual(
        expect.objectContaining({ method: 'POST' }),
      );
      expect(secondRequestCall[1].body).toEqual(
        expect.objectContaining({ isFake: true }),
      );
    });

    it('returns the original object if the body serializers have a File or FileList object', async () => {
      expect.assertions(3);
      const link = new RestLink({
        uri: '/api',
        bodySerializers: {
          upFiles: (body, headers) => ({
            body,
            headers,
          }),
        },
      });

      // define a File object
      const file = new File(['Love apollo'], 'apollo.txt', {
        type: 'text/plain',
      });
      //mocking FileList object
      const mockFileList = Object.create(FileList.prototype);
      Object.defineProperty(mockFileList, 'item', {
        value: function(number: number) {
          return mockFileList[number];
        },
        writable: false,
        enumerable: true,
        configurable: false,
      });
      Object.defineProperty(mockFileList, 'length', {
        value: 1,
        writable: false,
        enumerable: true,
        configurable: false,
      });
      mockFileList[0] = file;

      //body containing Primitives, Objects and Arrays types
      const post = {
        id: '1',
        title: 'Love apollo',
        items: [{ name: 'first' }, { name: 'second' }],
        attachments: mockFileList,
        cover: file,
      };

      fetchMock.post('/api/posts/newComplexPost', post);

      const createPostMutation = gql`
        fragment Item on any {
          name: String
        }

        fragment PublishablePostInput on REST {
          id: String
          title: String
          items {
            ...Item
          }
          cover: File
          attachment: FileList
        }

        mutation publishPost($input: PublishablePostInput!) {
          publishedPost(input: $input)
            @rest(
              type: "Post"
              path: "/posts/newComplexPost"
              method: "POST"
              bodySerializer: "upFiles"
            ) {
            id
            title
            items
            cover
            attachments
          }
        }
      `;

      await toPromise<Result>(
        execute(link, {
          operationName: 'publishPost',
          query: createPostMutation,
          variables: { input: post },
        }),
      );

      const requestCall = fetchMock.calls('/api/posts/newComplexPost')[0];
      expect(requestCall[1]).toEqual(
        expect.objectContaining({ method: 'POST' }),
      );
      expect(requestCall[1].body).toEqual(
        expect.objectContaining({ cover: file }),
      );
      expect(requestCall[1].body).toEqual(
        expect.objectContaining({ attachments: mockFileList }),
      );
    });

    it('throws if there is no custom serializer defined', () => {
      expect.assertions(1);
      const link = new RestLink({
        uri: '/api',
      });

      const createPostMutation = gql`
        mutation CreatePost($input: any!) {
          createPost(input: $input)
            @rest(
              type: "Post"
              method: "POST"
              path: "/posts/createPost"
              bodySerializer: "missing"
            ) {
            id
          }
        }
      `;

      const post = { id: '1' };

      return toPromise<Result>(
        execute(link, {
          operationName: 'publishPost',
          query: createPostMutation,
          variables: { input: post },
        }),
      ).catch(e =>
        expect(e).toEqual(
          new Error(
            '"bodySerializer" must correspond to configured serializer. Please make sure to specify a serializer called missing in the "bodySerializers" property of the RestLink.',
          ),
        ),
      );
    });
  });
});

describe('validateRequestMethodForOperationType', () => {
  describe('for operation type "mutation"', () => {
    it('throws because it is not supported yet', () => {
      expect.assertions(1);
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
      await toPromise<Result>(
        execute(link, {
          operationName: 'postTitle',
          query: postTagWithoutExport,
          variables: { id: '1' },
        }),
      );
    } catch (e) {
      expect(e.message).toBe(
        'Missing parameters to run query, specify it in the query params or use ' +
          'an export directive. (If you need to use ":" inside a variable string' +
          ' make sure to encode the variables properly using `encodeURIComponent' +
          '`. Alternatively see documentation about using pathBuilder.)',
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

    const { data } = await toPromise<Result>(
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

    const { data } = await toPromise<Result>(
      execute(link, {
        operationName: 'postTitle',
        query: postTagExport,
        variables: { id: '1' },
      }),
    );

    expect(data.post.tag).toEqual({ ...tag, __typename: 'Tag' });
    expect(data.post.author).toEqual({ ...author, __typename: 'User' });
  });

  it('can handle nested exports with deeply structured response data', async () => {
    expect.assertions(3);

    const link = new RestLink({ uri: '/api' });

    const user = {
      id: 'user-a',
      posts: [
        {
          id: 'post-a',
          tags: [
            {
              id: 'tag-a',
            },
            {
              id: 'tag-b',
            },
          ],
        },
        {
          id: 'post-b',
          tags: [
            {
              id: 'tag-c',
            },
          ],
        },
      ],
    };
    fetchMock.get('/api/user', user);
    const postATagA = {
      id: 'tag-a-details',
      message: 'this is tag details a',
    };
    fetchMock.get('/api/posts/post-a/tags/tag-a', postATagA);
    const postATagB = {
      id: 'tag-b-details',
      message: 'this is tag details b',
    };
    fetchMock.get('/api/posts/post-a/tags/tag-b', postATagB);
    const postBTagC = {
      id: 'tag-c-details',
      message: 'this is tag details c',
    };
    fetchMock.get('/api/posts/post-b/tags/tag-c', postBTagC);

    const userPostsWithTagDetails = gql`
      query userPostsWithTagDetails {
        user @rest(path: "/user") {
          id
          posts {
            id @export(as: "postId")
            tags {
              id @export(as: "tagId")
              details
                @rest(
                  path: "/posts/{exportVariables.postId}/tags/{exportVariables.tagId}"
                ) {
                id
                message
              }
            }
          }
        }
      }
    `;

    const { data } = await toPromise<Result>(
      execute(link, {
        operationName: 'userPostsWithTagDetails',
        query: userPostsWithTagDetails,
      }),
    );

    expect(data.user.posts[0].tags[0].details.message).toEqual(
      'this is tag details a',
    );
    expect(data.user.posts[0].tags[1].details.message).toEqual(
      'this is tag details b',
    );
    expect(data.user.posts[1].tags[0].details.message).toEqual(
      'this is tag details c',
    );
  });

  it('can handle @exports nested within @type-patched nodes', async () => {
    expect.assertions(1);
    const link = new RestLink({ uri: '/api' });

    const comments = [{ id: '1', comment: 'Me too!' }];
    const post = { id: '1', title: 'Love apollo', comments };
    fetchMock.get('/api/post/1', post);

    const commentDetails = [{ id: '1', author: 'Joe', likes: 10 }];
    fetchMock.get('/api/comment/1', commentDetails);

    const getPostWithCommentsAndDetails = gql`
      query getPostWithCommentsAndDetails {
        post(id: "1") @rest(type: "Post", path: "/post/:id") {
          id
          comments @type(name: "Comment") {
            id @export(as: "commentId")
            details @rest(type: "CommentDetails", path: "/comment/:commentId") {
              id
              author
              likes
            }
          }
        }
      }
    `;

    const { data } = await toPromise<Result>(
      execute(link, {
        operationName: 'getPostWithCommentsAndDetails',
        query: getPostWithCommentsAndDetails,
        variables: { id: '1' },
      }),
    );

    expect(data.post.comments[0].details[0]).toEqual({
      ...commentDetails[0],
      __typename: 'CommentDetails',
    });
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

  it('has an undefined body on GET requests', async () => {
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

    await client.query({
      query: postTagExport,
    });

    expect(fetchMock.lastCall()[1].body).toBeUndefined();
  });

  it('treats absent response fields as optional', async done => {
    // Discovered in: https://github.com/apollographql/apollo-link-rest/issues/74

    const link = new RestLink({ uri: '/api' });

    const post = {
      id: '1',
      title: 'Love apollo',
      content: 'Best graphql client ever.',
    };
    const comments = [{ id: 'c.12345', text: 'This is great.' }];
    fetchMock.get('/api/post/1', post);
    fetchMock.get('/api/post/1/comments', comments);

    const postTitleQuery = gql`
      query postTitle {
        post @rest(type: "Post", path: "/post/1") {
          id
          title
          unfairCriticism
          comments @rest(type: "Comment", path: "/post/1/comments") {
            id
            text
            spammyContent
          }
        }
      }
    `;

    const { data } = await toPromise<Result>(
      execute(link, {
        operationName: 'postWithContent',
        query: postTitleQuery,
      }),
    );

    expect(data.post.unfairCriticism).toBeNull();

    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link,
    });

    const { data: data2 }: { data: any } = await client.query({
      query: postTitleQuery,
    });
    expect(data2.post.unfairCriticism).toBeNull();

    const errorLink = onError(opts => {
      console.error(opts);
      const { networkError, graphQLErrors } = opts;
      expect(
        networkError || (graphQLErrors && graphQLErrors.length > 0),
      ).toBeTruthy();
    });
    const combinedLink = ApolloLink.from([
      new RestLink({
        uri: '/api',
        typePatcher: {
          Post: (
            data: any,
            outerType: string,
            patchDeeper: RestLink.FunctionalTypePatcher,
          ): any => {
            // Let's make unfairCriticism a Required Field
            if (data.unfairCriticism == null) {
              throw new Error(
                'Required Field: unfairCriticism missing in RESTResponse.',
              );
            }
            return data;
          },
        },
      }),
      errorLink,
    ]);
    const client3 = new ApolloClient({
      cache: new InMemoryCache(),
      link: combinedLink,
    });
    try {
      const result = await client3.query({
        query: postTitleQuery,
      });
      const { errors } = result;
      if (errors && errors.length > 0) {
        throw new Error('All is well, errors were thrown as expected');
      }
      done.fail('query should throw some sort of error');
    } catch (error) {
      done();
    }
  });

  it('can catch HTTP Status errors', async done => {
    const link = new RestLink({ uri: '/api' });

    const status = 403;

    // setup onError link
    const errorLink = onError(opts => {
      const { networkError } = opts;
      if (networkError != null) {
        //console.debug(`[Network error]: ${networkError}`);
        const { statusCode } = networkError as RestLink.ServerError;
        expect(statusCode).toEqual(status);
      }
    });
    const combinedLink = ApolloLink.from([errorLink, link]);

    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link: combinedLink,
    });

    fetchMock.mock('/api/post/1', {
      status,
      body: { id: 1 },
    });

    try {
      await client.query({
        query: sampleQuery,
      });
      done.fail('query should throw a network error');
    } catch (error) {
      done();
    }
  });

  it('supports being cancelled and does not throw', done => {
    class AbortError extends Error {
      constructor(message) {
        super(message);
        this.name = message;
      }
    }
    const customFetch = () =>
      new Promise((_, reject) => {
        reject(new AbortError('AbortError'));
      });

    const link = new RestLink({
      uri: '/api',
      customFetch: customFetch as any,
    });

    const sub = execute(link, { query: sampleQuery }).subscribe({
      next: () => {
        done.fail('result should not have been called');
      },
      error: e => {
        done.fail(e);
      },
      complete: () => {
        done.fail('complete should not have been called');
      },
    });

    setTimeout(() => {
      sub.unsubscribe();
      done();
    }, 0);
  });
});

describe('Playing nice with others', () => {
  afterEach(() => {
    fetchMock.restore();
  });

  function buildLinks() {
    const restLink = new RestLink({ uri: '/api' });
    const httpLink = new HttpLink({ uri: '/graphql' });
    return { restLink, httpLink };
  }

  const posts = [
    { title: 'Love apollo' },
    { title: 'Respect apollo', meta: { creatorId: 1 } },
  ];
  const authors = { data: { authors: [{ id: 1 }, { id: 2 }, { id: 3 }] } };
  const authorErrors = {
    errors: {
      authors: { message: 'Your query was bad and you should feel bad!' },
    },
  };

  it('should work alongside apollo-link-http', async () => {
    fetchMock.get('/api/posts', posts);
    fetchMock.post('/graphql', authors);
    const { restLink, httpLink } = buildLinks();
    const link = from([restLink, httpLink]);
    const restQuery = gql`
      query {
        people @rest(type: "[Post]", path: "/posts") {
          title
        }
      }
    `;
    const httpQuery = gql`
      query {
        authors {
          id
        }
      }
    `;
    const combinedQuery = gql`
      query {
        authors {
          id
        }
        people @rest(type: "[Post]", path: "/posts") {
          title
        }
      }
    `;
    const { data: restData } = await toPromise<Result>(
      execute(link, { operationName: 'restQuery', query: restQuery }),
    );
    const { data: httpData } = await toPromise<Result>(
      execute(link, { operationName: 'httpData', query: httpQuery }),
    );
    const { data: combinedData } = await toPromise<Result>(
      execute(link, { operationName: 'combinedQuery', query: combinedQuery }),
    );
    expect(restData).toEqual({
      people: [
        { title: 'Love apollo', __typename: 'Post' },
        { title: 'Respect apollo', __typename: 'Post' },
      ],
    });
    expect(httpData).toEqual({ authors: [{ id: 1 }, { id: 2 }, { id: 3 }] });
    expect(combinedData).toEqual({
      people: [
        { title: 'Love apollo', __typename: 'Post' },
        { title: 'Respect apollo', __typename: 'Post' },
      ],
      authors: [{ id: 1 }, { id: 2 }, { id: 3 }],
    });
  });

  it('should work nested in apollo-link-http', async () => {
    fetchMock.get('/api/posts/1', [posts[0]]);
    fetchMock.get('/api/posts/2', [posts[1]]);
    fetchMock.get('/api/posts/3', []);
    fetchMock.post('/graphql', authors);

    const { restLink, httpLink } = buildLinks();
    const link = from([restLink, httpLink]);

    const combinedQuery = gql`
      query {
        authors {
          id @export(as: "id")
          posts @rest(type: "[Post]", path: "/posts/{exportVariables.id}") {
            title
          }
        }
      }
    `;

    const { data: combinedData } = await toPromise<Result>(
      execute(link, { operationName: 'combinedQuery', query: combinedQuery }),
    );

    expect(combinedData).toEqual({
      authors: [
        {
          id: 1,
          posts: [{ title: 'Love apollo', __typename: 'Post' }],
        },
        {
          id: 2,
          posts: [{ title: 'Respect apollo', __typename: 'Post' }],
        },
        {
          id: 3,
          posts: [],
        },
      ],
    });
  });

  it('should forward errors from apollo-link-http', async () => {
    fetchMock.get('/api/posts', posts);
    fetchMock.post('/graphql', authorErrors);
    const { restLink, httpLink } = buildLinks();
    const link = from([restLink, httpLink]);

    const combinedQuery = gql`
      query {
        authors {
          id
        }
        people @rest(type: "[Post]", path: "/posts") {
          title
        }
      }
    `;

    const { data: combinedData, errors } = await toPromise<Result>(
      execute(link, { operationName: 'combinedQuery', query: combinedQuery }),
    );

    expect(combinedData).toEqual({
      people: [
        { title: 'Love apollo', __typename: 'Post' },
        { title: 'Respect apollo', __typename: 'Post' },
      ],
    });

    expect(errors).toEqual({
      authors: { message: 'Your query was bad and you should feel bad!' },
    });
  });
});
