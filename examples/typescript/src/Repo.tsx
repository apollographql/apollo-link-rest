import * as React from 'react';
import { graphql, ChildProps } from '@apollo/client/react/hoc';
import gql from 'graphql-tag';

// The Result type we expect back.
// See https://developer.github.com/v3/repos/#get
interface Result {
  repo: {
    id: number;
    name: string;
    description: string;
    html_url: string;
  };
}

// The props we expect to be passed directly to this component.
interface OwnProps {
  name: string;
}

// Define the Props for the Repo component using React Apollo's
// ChildProps generic inteface with the expected Result.
type Props = ChildProps<OwnProps, Result>;

// Standard React Component, using the injected data prop.
class RepoBase extends React.Component<Props, {}> {
  public render() {
    const { data } = this.props;

    if (data && data.repo) {
      return (
        <div>
          <h3>
            <a href={data.repo.html_url}>{data.repo.name}</a>
          </h3>
          <p>{data.repo.description}</p>
        </div>
      );
    } else if (data && data.loading) {
      return <div>Loading...</div>;
    } else {
      return null;
    }
  }
}

// Setup a basic query to retrieve data for that repository given a name
const query = gql`
  query Repo($name: String!) {
    repo(name: $name) @rest(type: "Repo", path: "/repos/apollographql/:name") {
      id
      name
      description
      html_url
    }
  }
`;

// Connect the component using React Apollo's higher order component
// and inject the data into the component. The Result type is what
// we expect the shape of the response to be and OwnProps is what we
// expect to be passed to this component.
const Repo = graphql<OwnProps>(query, {
  options: ({ name }) => ({ variables: { name } }),
})(RepoBase);

export { Repo };
