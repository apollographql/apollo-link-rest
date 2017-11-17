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

      const restAPIDirectives = selectionSet.selections[0].directives[0];
      const selectionName = selectionSet.selections[0].name.value;
      const resKeys = selectionSet.selections[0].selectionSet.selections.map(({ name }) => name.value);
      const route = restAPIDirectives.arguments[1].value.value;
      const __typename = restAPIDirectives.arguments[0].value.value;

      fetch(`${this.uri}${route}`)
        .then(data => data.json())
        .then(data => {
          const dataFiltered = resKeys.reduce((acc, e) => { acc[e] = data[e]; return acc}, {});
          const withTypeName = { ...dataFiltered, __typename };
          observer.next({ [selectionName]: withTypeName });
          observer.complete()
        })
        .catch(observer.error.bind(observer))
    })
  }
}

export default RestAPILink;
