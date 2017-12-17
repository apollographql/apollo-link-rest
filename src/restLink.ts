import { OperationTypeNode } from 'graphql';
import {
  ApolloLink,
  Observable,
  Operation,
  NextLink,
  FetchResult,
} from 'apollo-link';
import {
  hasDirectives,
  getMainDefinition,
  addTypenameToDocument,
} from 'apollo-utilities';
import { graphql, ExecInfo } from 'graphql-anywhere/lib/async';
import { Resolver } from 'graphql-anywhere';

export namespace RestLink {
  export type URI = string;

  export type Endpoint = string;
  export interface Endpoints {
    [endpointKey: string]: Endpoint;
  }

  export type Header = string;
  export interface HeadersHash {
    [headerKey: string]: Header;
  }
  export type InitializationHeaders = HeadersHash | Headers | string[][];

  export type HeadersMergePolicy = (...headerGroups: Headers[]) => Headers;

  export interface FieldNameNormalizer {
    (fieldName: string): string;
  }

  export type CustomFetch = (
    request: RequestInfo,
    init: RequestInit,
  ) => Promise<Response>;

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
    headers?: InitializationHeaders;

    /**
     * A function that takes the response field name and converts it into a GraphQL compliant name
     */
    fieldNameNormalizer?: FieldNameNormalizer;

    /**
     * The credentials policy you want to use for the fetch call.
     */
    credentials?: RequestCredentials;

    /**
     * Use a custom fetch to handle REST calls.
     */
    customFetch?: CustomFetch;
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

const replaceParam = (
  endpoint: string,
  name: string,
  value: string,
): string => {
  if (!value || !name) {
    return endpoint;
  }
  return endpoint.replace(`:${name}`, value);
};

const convertObjectKeys = (
  object: object,
  converter: (value: string) => string,
): object => {
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

/**
 * Helper that makes sure our headers are of the right type to pass to Fetch
 */
export const normalizeHeaders = (
  headers: RestLink.InitializationHeaders,
): Headers => {
  // Make sure that our headers object is of the right type
  if (headers instanceof Headers) {
    return headers;
  } else {
    return new Headers(headers);
  }
};

/**
 * Returns a new Headers Group that contains all the headers.
 * - If there are duplicates, they will be in the returned header set multiple times!
 */
export const concatHeadersMergePolicy: RestLink.HeadersMergePolicy = (
  ...headerGroups: Headers[]
): Headers => {
  return headerGroups.reduce((accumulator, current) => {
    if (!current) {
      return accumulator;
    }
    if (!current.forEach) {
      current = normalizeHeaders(current);
    }
    current.forEach((value, key) => {
      accumulator.append(key, value);
    });

    return accumulator;
  }, new Headers());
};

/**
 * This merge policy deletes any matching headers from the link's default headers.
 * - Pass headersToOverride array & a headers arg to context and this policy will automatically be selected.
 */
export const overrideHeadersMergePolicyHelper = (
  linkHeaders: Headers,
  headersToOverride: string[],
  requestHeaders: Headers | null,
): Headers => {
  const result = new Headers();
  linkHeaders.forEach((value, key) => {
    if (headersToOverride.indexOf(key) !== -1) {
      return;
    }
    result.append(key, value);
  });
  return concatHeadersMergePolicy(result, requestHeaders || new Headers());
};
const makeOverrideHeadersMergePolicy = (
  headersToOverride: string[],
): RestLink.HeadersMergePolicy => {
  return (linkHeaders, requestHeaders) => {
    return overrideHeadersMergePolicyHelper(
      linkHeaders,
      headersToOverride,
      requestHeaders,
    );
  };
};

export const validateRequestMethodForOperationType = (
  method: string,
  operationType: OperationTypeNode,
): void => {
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
      const _exhaustiveCheck: never = operationType;
      return _exhaustiveCheck;
  }
};

let exportVariables = {};

/** Apollo-Link getContext, provided from the user & mutated by upstream links */
interface LinkChainContext {
  /** Credentials Policy for Fetch */
  credentials?: RequestCredentials | null;

  /** Headers the user wants to set on this request. See also headersMergePolicy */
  headers?: RestLink.InitializationHeaders | null;

  /** Will default to concatHeadersMergePolicy unless headersToOverride is set */
  headersMergePolicy?: RestLink.HeadersMergePolicy | null;

  /** List of headers to override, passing this will swap headersMergePolicy if necessary */
  headersToOverride?: string[] | null;
}

/** Context passed via graphql() to our resolver */
interface RequestContext {
  /** Headers the user wants to set on this request. See also headersMergePolicy */
  headers: Headers;

  /** Credentials Policy for Fetch */
  credentials?: RequestCredentials | null;

  endpoints: RestLink.Endpoints;
  customFetch: RestLink.CustomFetch;
}

const resolver: Resolver = async (
  fieldName: string,
  root: any,
  args: any,
  context: RequestContext,
  info: ExecInfo,
) => {
  const { directives, isLeaf, resultKey } = info;
  if (root === null) {
    exportVariables = {};
  }
  if (isLeaf) {
    const leafValue = root[resultKey];
    if (directives && directives.export) {
      exportVariables[directives.export.as] = leafValue;
    }
    return leafValue;
  }
  const { credentials, endpoints, headers, customFetch } = context;
  const { path, endpoint } = directives.rest;
  const uri = getURIFromEndpoints(endpoints, endpoint);
  try {
    const argsWithExport = { ...args, ...exportVariables };
    let pathWithParams = Object.keys(argsWithExport).reduce(
      (acc, e) => replaceParam(acc, e, argsWithExport[e]),
      path,
    );
    if (pathWithParams.includes(':')) {
      throw new Error(
        'Missing params to run query, specify it in the query params or use an export directive',
      );
    }
    let { method, type } = directives.rest;
    if (!method) {
      method = 'GET';
    }
    validateRequestMethodForOperationType(method, 'query');
    return await (customFetch || fetch)(`${uri}${pathWithParams}`, {
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
  private headers: Headers;
  private fieldNameNormalizer: RestLink.FieldNameNormalizer;
  private credentials: RequestCredentials;
  private customFetch: RestLink.CustomFetch;

  constructor({
    uri,
    endpoints,
    headers,
    fieldNameNormalizer,
    customFetch,
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
    this.headers = normalizeHeaders(headers);
    this.credentials = credentials || null;
    this.customFetch = customFetch;
  }

  public request(
    operation: Operation,
    forward?: NextLink,
  ): Observable<FetchResult> | null {
    const { query, variables, getContext } = operation;
    const context: LinkChainContext | any = getContext() as any;
    const isRestQuery = hasDirectives(['rest'], operation.query);
    if (!isRestQuery) {
      return forward(operation);
    }

    // 1. Use the user's merge policy if any
    let headersMergePolicy: RestLink.HeadersMergePolicy =
      context.headersMergePolicy;
    if (
      headersMergePolicy == null &&
      Array.isArray(context.headersToOverride)
    ) {
      // 2.a. Override just the passed in headers, if user provided that optional array
      headersMergePolicy = makeOverrideHeadersMergePolicy(
        context.headersToOverride,
      );
    } else if (headersMergePolicy == null) {
      // 2.b Glue the link (default) headers to the request-context headers
      headersMergePolicy = concatHeadersMergePolicy;
    }

    const headers = headersMergePolicy(this.headers, context.headers);

    const credentials: RequestCredentials =
      context.credentials || this.credentials;

    const queryWithTypename = addTypenameToDocument(query);

    let resolverOptions: {
      resultMapper?: (fields: any) => any;
    } = {};
    if (this.fieldNameNormalizer) {
      resolverOptions.resultMapper = resultFields => {
        return convertObjectKeys(resultFields, this.fieldNameNormalizer);
      };
    }

    return new Observable(observer => {
      graphql(
        resolver,
        queryWithTypename,
        null,
        {
          headers,
          endpoints: this.endpoints,
          export: exportVariables,
          credentials,
          customFetch: this.customFetch,
        },
        variables,
        resolverOptions,
      )
        .then(data => {
          observer.next({ data });
          observer.complete();
        })
        .catch(err => {
          observer.error(err);
        });
    });
  }
}
