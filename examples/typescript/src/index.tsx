import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { RestLink } from 'apollo-link-rest';
import { ApolloClient, InMemoryCache, ApolloProvider } from '@apollo/client';

import { RepoSearch } from './RepoSearch';

import './index.css';

// Create a RestLink for the Github API
const link = new RestLink({ uri: 'https://api.github.com' });

// Configure the ApolloClient with the recommended cache and our RestLink
const client = new ApolloClient({
  cache: new InMemoryCache(),
  link,
});

const container = document.getElementById('root')!;
const root = createRoot(container);

root.render(
  <ApolloProvider client={client}>
    <RepoSearch />
  </ApolloProvider>,
);
