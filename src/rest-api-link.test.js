import { execute, makePromise } from 'apollo-link'
import gql from 'graphql-tag'
import fetchMock from 'fetch-mock'
import RestAPILink from './rest-api-link'

describe('Query', () => {
  afterEach(() => {
    fetchMock.restore()
  })

  it('can get a post', async () => {
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

    expect(data).toEqual({ post: { ...post, __typename: 'Post'} })
  })
})
