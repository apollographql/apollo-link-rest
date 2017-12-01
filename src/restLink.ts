import { ApolloLink, Observable } from 'apollo-link';
import { hasDirectives, getQueryDefinition } from 'apollo-utilities';
import { filterObjectWithKeys, ArrayToObject } from './utils';

const getRestDirective = selection =>
  selection.directives.filter(
    directive =>
      directive.kind === 'Directive' && directive.name.value === 'rest',
  )[0];

const getTypeNameFromDirective = directive => {
  const typeArgument = directive.arguments.filter(
    argument => argument.name.value === 'type',
  )[0];
  return typeArgument.value.value;
};

const getRouteFromDirective = directive => {
  const routeArgument = directive.arguments.filter(argument => argument.name.value === 'route')[0] || {};
  return (routeArgument.value || {}).value;
}

const getEndpointFromDirective = directive => {
  const endpointArgument = directive.arguments.filter(
    argument => argument.name.value === 'endpoint',
  )[0] || {};
  return (endpointArgument.value || {}).value;
}

const getURIFromEndpoints = (endpoints, endpoint) => {
  return endpoints[endpoint || DEFAULT_ENDPOINT_KEY] || endpoints[DEFAULT_ENDPOINT_KEY];
}

const getSelectionName = selection => selection.name.value;
const getResultKeys = selection =>
  selection.selectionSet.selections.map(({ name }) => name.value);

const getQueryParams = selection =>
  selection.arguments.map(p => ({
    name: p.name.value,
    value: p.value.value,
  }));

const replaceParam = (endpoint, name, value) => {
  if (!value || !name) {
    return endpoint;
  }
  return endpoint.replace(`:${name}`, value);
};

const replaceParamsInsideRoute = (fullRoute, queryParams, variables) => {
  const endpointWithQueryParams = queryParams.reduce(
    (acc, { name, value }) => replaceParam(acc, name, value),
    fullRoute,
  );
  const endpointWithInputVariables = Object.keys(variables).reduce(
    (acc, e) => replaceParam(acc, e, variables[e]),
    endpointWithQueryParams,
  );
  return endpointWithInputVariables;
};

const getRequests = (selections, variables, endpoints) =>
  selections.map(selection => {
    const selectionName = getSelectionName(selection);
    const filteredKeys = getResultKeys(selection);
    const directive = getRestDirective(selection);
    const endpoint = getEndpointFromDirective(directive) || "";
    const route = getRouteFromDirective(directive) || "";
    const __typename = getTypeNameFromDirective(directive);
    const queryParams = getQueryParams(selection);

    const uri = getURIFromEndpoints(endpoints, endpoint);
    const fullRoute = uri + route;
    const endpointWithParams = replaceParamsInsideEndpoints(
      fullRoute,
      queryParams,
      variables,
    );

    return {
      name: selectionName,
      filteredKeys,
      endpoint: `${endpointAndRouteWithParams}`,
      __typename,
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
/**
 * Default key to use when the @rest directive omits the "endpoint" parameter.
 */
const DEFAULT_ENDPOINT_KEY = "";

/**
 * RestLink is an apollo-link for communicating with REST services using GraphQL on the client-side
 * - @param: uri: default URI, optional if endpoints provides a default.
 * - @param: endpoints: optional map of potential API endpoints this RestLink will hit.
 */
export class RestLink extends ApolloLink {
  private endpoints: { [endpointKey: string]: string };
  constructor({ uri, endpoints }) {
    super();
    const fallback = {};
    fallback[DEFAULT_ENDPOINT_KEY] = uri || '';
    this.endpoints = Object.assign({}, endpoints || fallback);

    if (uri == null && endpoints == null) {
      throw new Error("A RestLink must be initialized with either 1 uri, or a map of keyed-endpoints");
    }
    if (uri != null) {
      const currentDefaultURI = (endpoints || {})[DEFAULT_ENDPOINT_KEY];
      if (currentDefaultURI != null && currentDefaultURI != uri) {
        throw new Error("RestLink was configured with a default uri that doesn't match what's passed in to the endpoints map.");
      }
      this.endpoints[DEFAULT_ENDPOINT_KEY] == uri;
    }
    
    // if (this.endpoints[DEFAULT_ENDPOINT_KEY] == null) {
    //   console.warn("RestLink configured without a default URI. All @rest(…) directives must provide an endpoint key!");
    // }
  }

  request(operation) {
    const { query } = operation;
    const isRestQuery = hasDirectives(['rest'], operation.query);
    if (!isRestQuery) {
      // should we forward the request ?
    }
    return new Observable(observer => {
      // for now doing query only
      const queryDefinition = getQueryDefinition(query);
      const { variables } = operation;
      const { selectionSet: { selections } } = queryDefinition;
      const requestsParams = getRequests(selections, variables, this.endpoints);

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
