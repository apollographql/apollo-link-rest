import { ApolloLink, Observable } from 'apollo-link'

class RestAPILink extends ApolloLink {
  constructor({ uri }) {
    super();
    this.uri = uri;
  }

  request(operation) {
    return new Observable(observer => {
      const queryDefinition = operation.query.definitions[0]
      const { selectionSet } = queryDefinition

      // rest API directives
      const restAPIDirectives = selectionSet.selections[0].directives[0];
      const route = restAPIDirectives.arguments[1].value.value;

      fetch(`${this.uri}${route}`)
        .then(data => data.json())
        .then(data => {
          //calls the next callback for the subscription
          observer.next(data)
          observer.complete()
        })
        .catch(observer.error.bind(observer))
    })
  }
}

export default RestAPILink;
