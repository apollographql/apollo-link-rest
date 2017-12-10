import { OperationTypeNode } from 'graphql';
import {
  ApolloLink,
  Observable,
  Operation,
  NextLink,
  FetchResult,
} from 'apollo-link';
import { hasDirectives, addTypenameToDocument } from 'apollo-utilities';
import { graphql } from 'graphql-anywhere/lib/async';

export namespace RestLink {
  export type URI = string;

  export type Endpoint = string;
  export interface Endpoints {
    [endpointKey: string]: Endpoint;
  }

  export type Header = string;
  export interface Headers {
    [headerKey: string]: Header;
  }

  export type FieldNameNormalizer = (fieldName: string) => string;

  export type Credentials = string;

  export type Options = {
    /**
     * The URI to use when fetching operations.
     *
     * Optional if endpoints provides a default.
     */
    uri?: URI;

    /**
     * A root endpoint (uri) to apply paths to or a map of endpoints.
     */
    endpoints?: Endpoints;

    /**
     * An object representing values to be sent as headers on the request.
     */
    headers?: Headers;

    /**
     * A function that takes the response field name and converts it into a GraphQL compliant name
     */
    fieldNameNormalizer?: FieldNameNormalizer;

    /**
     * The credentials policy you want to use for the fetch call.
     */
    credentials?: Credentials;
  };
}

const addTypeNameToResult = (
  result: any[] | object,
  __typename: string,
): any[] | object => {
  if (Array.isArray(result)) {
    return result.map(e => ({ ...e, __typename }));
  }
  return { ...result, __typename };
};

const getURIFromEndpoints = (
  endpoints: RestLink.Endpoints,
  endpoint: RestLink.Endpoint,
): RestLink.URI => {
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

const convertObjectKeys = (object, converter) => {
  return Object.keys(object)
    .filter(e => e !== '__typename')
    .reduce((acc, val) => {
      let value = object[val];
      if (typeof value === 'object') {
        value = convertObjectKeys(value, converter);
      }
      if (Array.isArray(value)) {
        value = value.map(e => convertObjectKeys(e, converter));
      }
      acc[converter(val)] = value;
      return acc;
    }, {});
};

export const validateRequestMethodForOperationType = (
  method: string,
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
  const { directives, isLeaf, resultKey } = info;
  if (isLeaf) {
    return root[resultKey];
  }
  const { credentials, endpoints, headers } = context;
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
    return await fetch(`${uri}${pathWithParams}`, {
      credentials,
      method,
      headers,
    })
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
 */
export class RestLink extends ApolloLink {
  private endpoints: RestLink.Endpoints;
  private headers: RestLink.Headers;
  private fieldNameNormalizer: RestLink.FieldNameNormalizer;
  private credentials: RestLink.Credentials;

  constructor({
    uri,
    endpoints,
    headers,
    fieldNameNormalizer,
    credentials,
  }: RestLink.Options) {
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

    this.fieldNameNormalizer = fieldNameNormalizer || null;
    this.headers = headers || {};
    this.credentials = credentials || null;
  }

  public request(
    operation: Operation,
    forward?: NextLink,
  ): Observable<FetchResult> | null {
    const { query, variables, getContext } = operation;
    const {
      headers: contextHeaders = {},
      credentials: contextCredentials,
    } = getContext();
    const isRestQuery = hasDirectives(['rest'], operation.query);
    if (!isRestQuery) {
      return forward(operation);
    }

    const headers: RestLink.Headers = {
      ...this.headers,
      ...contextHeaders,
    };

    const credentials: RestLink.Credentials =
      contextCredentials || this.credentials;

    const queryWithTypename = addTypenameToDocument(query);

    let resolverOptions = {};
    if (this.fieldNameNormalizer) {
      resolverOptions = {
        resultMapper: resultFields =>
          convertObjectKeys(resultFields, this.fieldNameNormalizer),
      };
    }

    return new Observable(observer => {
      try {
        const result = graphql(
          resolver,
          queryWithTypename,
          null,
          { headers, endpoints: this.endpoints, credentials },
          variables,
          resolverOptions,
        );
        observer.next(result);
        observer.complete();
      } catch (err) {
        observer.error.bind(observer);
      }
    });
  }
}
