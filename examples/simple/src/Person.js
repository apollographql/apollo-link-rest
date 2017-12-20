import React, { Component } from 'react';
import { graphql } from 'react-apollo';
import gql from 'graphql-tag';

const Query = gql`
  query luke {
    person @rest(type: "Person", path: "people/1/") {
      name
    }
  }
`;

class Person extends Component {
  render() {
    const { loading, error, person } = this.props;
    if (loading) {
      return <h4>Loading...</h4>;
    }
    if (error) {
      return <h4>{error.message}</h4>;
    }
    return <h1>{person.name}</h1>;
  }
}
export default graphql(Query, {
  props: ({ data }) => {
    if (data.loading) {
      return {
        loading: data.loading,
      };
    }

    if (data.error) {
      return {
        error: data.error,
      };
    }
    return {
      person: data.person,
      loading: false,
    };
  },
})(Person);
