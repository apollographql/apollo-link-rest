import React, { Component } from 'react';
import { ApolloClient } from 'apollo-client';
import { InMemoryCache } from 'apollo-cache-inmemory';
import { ApolloProvider } from 'react-apollo';
import { RestLink } from 'apollo-link-rest';
import Person from './Person';
import './App.css';

const restLink = new RestLink({
  uri: 'https://swapi.co/api/',
});

const client = new ApolloClient({
  link: restLink,
  cache: new InMemoryCache(),
});

class App extends Component {
  render() {
    return (
      <div className="App">
        <header className="App-header">
          <h1 className="App-title">Welcome to Apollo Rest Link Example</h1>
        </header>
        <Person />
      </div>
    );
  }
}

const ApolloApp = () => (
  <ApolloProvider client={client}>
    <App />
  </ApolloProvider>
);

export default ApolloApp;
