import { ApolloLink, Observable } from 'apollo-link'
import { request } from 'https';

const getRequests = (selections, variables, uri) =>
  selections.map(selection => {
    const restAPIDirectives = selection.directives[0];
    const selectionName = selection.name.value;
    const resKeys = selection.selectionSet.selections.map(({ name }) => name.value);
    const route = restAPIDirectives.arguments[1].value.value;
    const __typename = restAPIDirectives.arguments[0].value.value;

    const paramsWithValue = selection.arguments.map(p => ({
      name: p.name.value,
      value: p.value.value
    }));

    const routeWithParams = paramsWithValue.reduce(
      (acc, { name, value }) => (value ? acc.replace(`:${name}`, value) : acc),
      route
    );
    const routeWithParams2 = Object.keys(variables).reduce(
      (acc, e) => acc.replace(`:${e}`, variables[e]),
      routeWithParams
    );

    return {
      name: selectionName,
      filteredKeys: resKeys,
      route: `${uri}${routeWithParams2}`,
      __typename
    };
  });

const addTypeNameToResult = (result, __typename) => {
  if(Array.isArray(result)) {
    return result.map(e => ({ ...e, __typename }))
  }
  return { ...result, __typename };
}

const filterObjWithKeys = (obj, keys) => (
  keys.reduce((acc, e) => {
    acc[e] = obj[e];
    return acc;
  }, {})
)

const filterResultWithKeys = (result, keys) => {
  if(Array.isArray(result)) {
    return result.map(elem => filterObjWithKeys(elem, keys))
  }
  return filterObjWithKeys(result, keys);
}

const processRequest = ({ name, filteredKeys, route, __typename}) => 
  new Promise((resolve, reject) => {
    fetch(route)
    .then(res => res.json())
    .then(data => {
      const dataFiltered = filterResultWithKeys(data, filteredKeys);
      resolve({ [name]: addTypeNameToResult(dataFiltered, __typename) })
    })
  })

async function processRequests(requestsParams) {
  const requests = requestsParams.map(processRequest);
  try {
   const res = await Promise.all(requests);
   return res.reduce((result, elem) => ({ ...result, ...elem }),  {});
  } catch (error) {
    throw new Error(error)
  }
}


class RestAPILink extends ApolloLink {
  constructor({ uri }) {
    super();
    this.uri = uri;
  }

  request(operation) {
    return new Observable( 
      (observer) => {
        const queryDefinition = operation.query.definitions[0]
        const { variables } = operation;
        const { selectionSet } = queryDefinition

        const requestsParams = getRequests(selectionSet.selections, variables, this.uri);

        try {
          const result = processRequests(requestsParams);
          observer.next(result);
          observer.complete();
        } catch (err) {
          observer.error.bind(observer)
        }
      }
    )
  }
}

export default RestAPILink;
