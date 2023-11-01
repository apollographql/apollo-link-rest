import React, { Component } from 'react';
import { graphql } from '@apollo/client/react/hoc';
import gql from 'graphql-tag';

const Season = ({ summary, number, image }) => (
  <div>
    <h2>{`Season ${number}`}</h2>
    {image && <img src={image.medium} />}
    <div dangerouslySetInnerHTML={{ __html: summary }} />
  </div>
);

const Query = gql`
  query($searchInput: String!) {
    show(search: $searchInput)
      @rest(type: "People", path: "singlesearch/shows?q=:search") {
      id @export(as: "showId")
      name
      seasons @rest(type: "Season", path: "shows/:showId/seasons") {
        number
        image
        summary
      }
    }
  }
`;

class ShowsResult extends Component {
  render() {
    const {
      data: { loading, error, show },
    } = this.props;
    if (loading) {
      return <h4>Loading...</h4>;
    }
    if (error) {
      return <h4>{error.message}</h4>;
    }
    return (
      <div>
        <h1>{show.name}</h1>
        {show.seasons.map(({ number, image, summary }) => (
          <Season
            key={number}
            number={number}
            image={image}
            summary={summary}
          />
        ))}
      </div>
    );
  }
}

const ShowsResultQuery = graphql(Query, {
  options: ({ searchInput }) => {
    return { variables: { searchInput } };
  },
})(ShowsResult);

class SearchShow extends Component {
  constructor() {
    super();
    this.state = {
      searchInput: '',
    };
  }
  render() {
    return (
      <div>
        <input
          value={this.state.search}
          placeholder="Your favorite show name"
          onChange={e => this.setState({ searchInput: e.target.value })}
        />
        <button onClick={e => this.setState({ launchSearch: true })}>
          {' '}
          Search{' '}
        </button>
        {this.state.searchInput !== '' && (
          <ShowsResultQuery searchInput={this.state.searchInput} />
        )}
      </div>
    );
  }
}

export default SearchShow;
