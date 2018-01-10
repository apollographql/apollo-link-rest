import * as React from 'react';
import { render } from 'react-dom';
import { RestLink } from 'apollo-link-rest';
import { ApolloClient } from 'apollo-client';
import { InMemoryCache } from 'apollo-cache-inmemory';
import { ApolloProvider } from 'react-apollo';

import { RepoSearch } from './RepoSearch';

import './index.css';

// Create a RestLink for the Github API
const link = new RestLink({ uri: 'https://api.github.com' });

// Configure the ApolloClient with the recommended cache and our RestLink
const client = new ApolloClient({
  cache: new InMemoryCache(),
  link,
});

render(
  <ApolloProvider client={client}>
    <RepoSearch />
  </ApolloProvider>,
  document.getElementById('root'),
);
