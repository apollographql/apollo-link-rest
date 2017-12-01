import { execute, makePromise } from 'apollo-link';
import gql from 'graphql-tag';
import * as fetchMock from 'fetch-mock';

import { RestLink } from '../';

describe('Configuration Errors', () => {
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

describe('Query single calls', () => {
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

    expect(data).toMatchObject({ post: { ...post, __typename: 'Post' } });
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

    const tagsWithTypeName = tags.map(tag => ({ ...tag, __typename: '[Tag]' }));
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
    expect(data2.post.title).toBe(postV2.title);
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
});
