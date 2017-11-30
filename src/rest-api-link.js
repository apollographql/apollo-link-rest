import { ApolloLink, Observable } from "apollo-link";
import { hasDirectives, getQueryDefinition } from "apollo-utilities";
import { filterObjectWithKeys, ArrayToObject } from './utils';

const getRestDirective = selection => selection.directives.filter(directive => 
      (directive.kind === 'Directive' && directive.name.value === 'rest'))[0]

const getTypeNameFromDirective = directive => {
  const typeArgument = directive.arguments.filter(argument => argument.name.value === 'type' )[0];
  return typeArgument.value.value;
}

const getEndpointFromDirective = directive => {
  const endpointArgument = directive.arguments.filter(argument => argument.name.value === 'endpoint')[0];
  return endpointArgument.value.value;
}

const getSelectionName = selection => selection.name.value;
const getResultKeys = selection => selection.selectionSet.selections.map(({ name }) => name.value);

const getQueryParams = selection => 
  selection.arguments.map(p => ({
    name: p.name.value,
    value: p.value.value
  }));

const replaceParam = (endpoint, name, value) => {
  if(!value || !name) {
    return endpoint;
  }
  return endpoint.replace(`:${name}`, value)
}

const replaceParamsInsideEndpoints = (endpoint, queryParams, variables) => {
  const endpointWithQueryParams = queryParams.reduce((acc, { name, value }) => replaceParam(acc, name, value), endpoint);
  const endpointWithInputVariables = Object.keys(variables).reduce((acc, e) => replaceParam(acc, e, variables[e]), endpointWithQueryParams);
  return endpointWithInputVariables;
};

const getRequests = (selections, variables, uri) =>
  selections.map(selection => {
    const selectionName = getSelectionName(selection);
    const filteredKeys = getResultKeys(selection); 
    const directive = getRestDirective(selection);
    const endpoint = getEndpointFromDirective(directive);
    const __typename = getTypeNameFromDirective(directive);
    const queryParams = getQueryParams(selection);
    const endpointWithParams = replaceParamsInsideEndpoints(endpoint, queryParams, variables);

    return {
      name: selectionName,
      filteredKeys,
      endpoint: `${uri}${endpointWithParams}`,
      __typename
    };
  });

const addTypeNameToResult = (result, __typename) => {
  if (Array.isArray(result)) {
    return result.map(e => ({ ...e, __typename }));
  }
  return { ...result, __typename };
};

const filterResultWithKeys = (result, keys) => {
  if (Array.isArray(result)) {
    return result.map(elem => filterObjectWithKeys(elem, keys));
  }
  return filterObjectWithKeys(result, keys);
};

const processRequest = ({ name, filteredKeys, endpoint, __typename }) =>
  new Promise((resolve, reject) => {
    fetch(endpoint)
      .then(res => res.json())
      .then(data => {
        const dataFiltered = filterResultWithKeys(data, filteredKeys);
        resolve({ [name]: addTypeNameToResult(dataFiltered, __typename) });
      })
      .catch(reject);
  });

async function processRequests(requestsParams) {
  const requests = requestsParams.map(processRequest);
  try {
    const requestsResults = await Promise.all(requests);
    return ArrayToObject(requestsResults);
  } catch (error) {
    throw new Error(error);
  }
}

class RestLink extends ApolloLink {
  constructor({ uri }) {
    super();
    this.uri = uri;
  }

  request(operation) {
    const { query } = operation;
    const isRestQuery = hasDirectives(["rest"], operation.query);
    if (!isRestQuery) {
      // should we forward the request ?
    }
    return new Observable(observer => {
      // for now doing query only
      const queryDefinition = getQueryDefinition(query);
      const { variables } = operation;
      const { selectionSet: { selections } } = queryDefinition;
      const requestsParams = getRequests(selections, variables, this.uri);

      try {
        const result = processRequests(requestsParams);
        observer.next(result);
        observer.complete();
      } catch (err) {
        observer.error.bind(observer);
      }
    });
  }
}

export default RestLink;
