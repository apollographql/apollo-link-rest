import { OperationTypeNode } from 'graphql';
import {
  ApolloLink,
  Observable,
  Operation,
  NextLink,
  FetchResult,
} from 'apollo-link';
import { hasDirectives, addTypenameToDocument } from 'apollo-utilities';
import { print } from 'graphql/language/printer';
import { graphql } from 'graphql-anywhere/lib/async';

export type RestLinkOptions = {
  uri: string;
  endpoints?: {
    [endpointKey: string]: string;
  };
  headers?: {
    [headerKey: string]: string;
  };
};

const addTypeNameToResult = (result, __typename) => {
  if (Array.isArray(result)) {
    return result.map(e => ({ ...e, __typename }));
  }
  return { ...result, __typename };
};

const getURIFromEndpoints = (endpoints, endpoint) => {
  return (
    endpoints[endpoint || DEFAULT_ENDPOINT_KEY] ||
    endpoints[DEFAULT_ENDPOINT_KEY]
  );
};

const replaceParam = (endpoint, name, value) => {
  if (!value || !name) {
    return endpoint;
  }
  return endpoint.replace(`:${name}`, value);
};

export const validateRequestMethodForOperationType = (
  method: String,
  operationType: OperationTypeNode,
) => {
  /**
   * NOTE: possible improvements
   * - use typed errors (e.g. ValidationError, MethodNotSupportedError)
   */
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
};

const resolver = async (fieldName, root, args, context, info) => {
  const { directives, isLeaf } = info;
  if (isLeaf) {
    return root[fieldName];
  }
  const { endpoints, headers } = context;
  const { path, endpoint } = directives.rest;
  const uri = getURIFromEndpoints(endpoints, endpoint);
  try {
    let pathWithParams = path;
    if (args) {
      pathWithParams = Object.keys(args).reduce(
        (acc, e) => replaceParam(acc, e, args[e]),
        path,
      );
    }
    let { method, type } = directives.rest;
    if (!method) {
      method = 'GET';
    }
    validateRequestMethodForOperationType(method, 'query');
    return await fetch(`${uri}${pathWithParams}`, { method, headers })
      .then(res => res.json())
      .then(result => addTypeNameToResult(result, type));
  } catch (error) {
    throw error;
  }
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

    if (this.endpoints[DEFAULT_ENDPOINT_KEY] == null) {
      console.warn(
        'RestLink configured without a default URI. All @rest(…) directives must provide an endpoint key!',
      );
    }

    this.headers = headers || {};
  }

  public request(
    operation: Operation,
    forward?: NextLink,
  ): Observable<FetchResult> | null {
    const { query, variables } = operation;
    const isRestQuery = hasDirectives(['rest'], operation.query);
    if (!isRestQuery) {
      return forward(operation);
    }

    const headers = {
      ...this.headers,
      ...(operation.getContext().headers || {}),
    };

    const queryWithTypename = addTypenameToDocument(query);

    return new Observable(observer => {
      try {
        const result = graphql(
          resolver,
          queryWithTypename,
          null,
          { headers, endpoints: this.endpoints },
          variables,
        );
        observer.next(result);
        observer.complete();
      } catch (err) {
        observer.error.bind(observer);
      }
    });
  }
}
