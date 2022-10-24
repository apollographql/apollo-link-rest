import * as React from 'react';

import { Repo } from './Repo';

interface State {
  repo: string;
}

// A basic dropdown component to select between several options.
class RepoSearch extends React.Component<{}, State> {
  constructor(props: {}) {
    super(props);

    this.state = {
      repo: 'apollo-link-rest',
    };
  }

  public render() {
    return (
      <div className="container">
        <label>Choose a repository:</label>
        <select
          value={this.state.repo}
          onChange={e => this.setState({ repo: e.target.value })}
        >
          <option value="apollo-link-rest">REST Link</option>
          <option value="apollo-link-state">State Link</option>
          <option value="apollo-link">Apollo Link</option>
          <option value="react-apollo">React Apollo</option>
          <option value="apollo-client">Apollo Client</option>
        </select>

        <Repo name={this.state.repo} />
      </div>
    );
  }
}

export { RepoSearch };
