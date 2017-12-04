import { OperationTypeNode } from 'graphql';
import { ApolloLink, Observable } from 'apollo-link';
import { hasDirectives, getQueryDefinition } from 'apollo-utilities';
import { filterObjectWithKeys, ArrayToObject } from './utils';

export type RestLinkOptions = {
  uri: string;
  endpoints?: {
    [endpointKey: string]: string;
  };
  headers?: {
    [headerKey: string]: string;
  };
};

type RequestParam = {
  name: string;
  filteredKeys: Array<string>;
  endpoint: string;
  method: string;
  __typename: string;
};

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

const getPathFromDirective = directive => {
  const pathArgument =
    directive.arguments.filter(argument => argument.name.value === 'path')[0] ||
    {};
  return (pathArgument.value || {}).value;
};

const getMethodFromDirective = directive => {
  const pathArgument =
    directive.arguments.filter(
      argument => argument.name.value === 'method',
    )[0] || {};
  return (pathArgument.value || {}).value;
};

const getEndpointFromDirective = directive => {
  const endpointArgument =
    directive.arguments.filter(
      argument => argument.name.value === 'endpoint',
    )[0] || {};
  return (endpointArgument.value || {}).value;
};

const getURIFromEndpoints = (endpoints, endpoint) => {
  return (
    endpoints[endpoint || DEFAULT_ENDPOINT_KEY] ||
    endpoints[DEFAULT_ENDPOINT_KEY]
  );
};

const getSelectionName = selection => selection.name.value;
const getResultKeys = (selection): Array<string> =>
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

const replaceParamsInsidePath = (fullPath, queryParams, variables) => {
  const endpointWithQueryParams = queryParams.reduce(
    (acc, { name, value }) => replaceParam(acc, name, value),
    fullPath,
  );
  const endpointWithInputVariables = Object.keys(variables).reduce(
    (acc, e) => replaceParam(acc, e, variables[e]),
    endpointWithQueryParams,
  );
  return endpointWithInputVariables;
};

const getRequests = (selections, variables, endpoints): Array<RequestParam> =>
  selections.map(selection => {
    const selectionName = getSelectionName(selection);
    const filteredKeys = getResultKeys(selection);
    const directive = getRestDirective(selection);
    const endpoint = getEndpointFromDirective(directive) || '';
    const path = getPathFromDirective(directive) || '';
    const method = getMethodFromDirective(directive) || 'GET';
    const __typename = getTypeNameFromDirective(directive);
    const queryParams = getQueryParams(selection);

    const uri = getURIFromEndpoints(endpoints, endpoint);

    const fullPath = uri + path;
    const endpointAndPathWithParams = replaceParamsInsidePath(
      fullPath,
      queryParams,
      variables,
    );

    return {
      name: selectionName,
      filteredKeys,
      endpoint: `${endpointAndPathWithParams}`,
      method,
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

const processRequest = ({
  name,
  filteredKeys,
  endpoint,
  method,
  headers,
  __typename,
}) =>
  new Promise((resolve, reject) => {
    fetch(endpoint, { method, headers })
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

export const validateRequestMethodForOperationType = (
  requestParams: Array<RequestParam>,
  operationType: OperationTypeNode,
) => {
  /**
   * NOTE: possible improvements
   * - use typed errors (e.g. ValidationError, MethodNotSupportedError)
   * - validate all requests before throwing the error
   */
  requestParams.forEach(({ method }) => {
    switch (operationType) {
      case 'query':
        if (method.toUpperCase() !== 'GET') {
          throw new Error(
            `A "query" operation can only support "GET" requests but got "${method}".`,
          );
        }
        return;
      case 'mutation':
        throw new Error('A "mutation" operation is not supported yet.');
      case 'subscription':
        throw new Error('A "subscription" operation is not supported yet.');
      default:
        // ignore
        return;
    }
  });
};

/**
 * Default key to use when the @rest directive omits the "endpoint" parameter.
 */
const DEFAULT_ENDPOINT_KEY = '';

/**
 * RestLink is an apollo-link for communicating with REST services using GraphQL on the client-side
 * - @param: uri: default URI, optional if endpoints provides a default.
 * - @param: endpoints: optional map of potential API endpoints this RestLink will hit.
 */
export class RestLink extends ApolloLink {
  private endpoints: { [endpointKey: string]: string };
  private headers: { [headerKey: string]: string };
  constructor({ uri, endpoints, headers }: RestLinkOptions) {
    super();
    const fallback = {};
    fallback[DEFAULT_ENDPOINT_KEY] = uri || '';
    this.endpoints = Object.assign({}, endpoints || fallback);

    if (uri == null && endpoints == null) {
      throw new Error(
        'A RestLink must be initialized with either 1 uri, or a map of keyed-endpoints',
      );
    }
    if (uri != null) {
      const currentDefaultURI = (endpoints || {})[DEFAULT_ENDPOINT_KEY];
      if (currentDefaultURI != null && currentDefaultURI != uri) {
        throw new Error(
          "RestLink was configured with a default uri that doesn't match what's passed in to the endpoints map.",
        );
      }
      this.endpoints[DEFAULT_ENDPOINT_KEY] == uri;
    }

    // if (this.endpoints[DEFAULT_ENDPOINT_KEY] == null) {
    //   console.warn("RestLink configured without a default URI. All @rest(…) directives must provide an endpoint key!");
    // }

    this.headers = headers || {};
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
      const { headers: headersFromContext } = operation.getContext();
      const requestsParams = getRequests(
        selections,
        variables,
        this.endpoints,
      ).map(params => ({
        ...params,
        headers: {
          ...this.headers,
          ...(headersFromContext || {}),
        },
      }));

      validateRequestMethodForOperationType(
        requestsParams,
        queryDefinition.operation,
      );

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
