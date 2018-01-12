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
    (fieldName: string, keypath?: string[]): string;
  }

  /** Used for mapping responses */
  export interface TypeNameContext {
    /** Back-reference to the parent context */
    parent: TypeNameContextReference;
    /** If this is a nested field, it will have the key name here */
    key: string | null;
    /** If there is a typename at this level, it'll be set here */
    __typename: string | null;
    /** TypeName was provided from the outside, possibly as an `@rest(type:)` parameter */
    isSticky: boolean;
    /** This type-context represents an array (these need to be handled specially) */
    isArray: boolean;
  }
  export type TypeNameContextReference = TypeNameContext | null;

  /** injects __typename using user-supplied code */
  export interface FunctionalTypePatcher {
    // TODO: consider adding RequestContext, Request-args, and ExecInfo parameters to this?
    (node: any, context: TypeNameContext): any;
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
     * A function that takes a GraphQL-compliant field name and converts it back into an endpoint-specific name
     * Can be overridden at the mutation-call-site (in the rest-directive).
     */
    fieldNameDenormalizer?: FieldNameNormalizer;

    /**
     * Structure to allow you to specify the __typename when you have nested objects in your REST response!
     */
    typePatcher?: FunctionalTypePatcher;

    /**
     * The credentials policy you want to use for the fetch call.
     */
    credentials?: RequestCredentials;

    /**
     * Use a custom fetch to handle REST calls.
     */
    customFetch?: CustomFetch;
  };

  /** @rest(...) Directive Options */
  export interface DirectiveOptions {
    /**
     * What HTTP method to use.
     * @default `GET`
     */
    method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    /** What GraphQL type to name the response */
    type?: string;
    /** What path to use */
    path: string;
    /**
     * What endpoint to select from the map of endpoints available to this link.
     * @default `RestLink.endpoints[DEFAULT_ENDPOINT_KEY]`
     */
    endpoint?: string;
    /**
     * Optional method that constructs a RequestBody out of the Environmental state
     * when processing this @rest(...) call. 
     * @default function that extracts the bodyKey from the args.
     */
    bodyBuilder?: (args: object) => object;
    /**
     * Optional field that defines the name of the env var to extract and use as the body
     * @default "input"
     * @see https://dev-blog.apollodata.com/designing-graphql-mutations-e09de826ed97
     */
    bodyKey?: string;
    /**
     * A per-request name denormalizer, this permits special endpoints to have their
     * field names remapped differently from the default.
     * @default Uses RestLink.fieldNameDenormalizer
     */
    fieldNameDenormalizer?: RestLink.FieldNameNormalizer;
    /**
     * A method to allow insertion of __typename deep in response objects
     */
    typePatcher?: RestLink.FunctionalTypePatcher;
  }
}

const popOneSetOfArrayBracketsFromTypeName = (typename: string): string => {
  const noSpace = typename.replace(/\s/g, '');
  const sansOneBracketPair = noSpace.replace(
    /\[(.*)\]/,
    (str, matchStr, offset, fullStr) => {
      return (
        ((matchStr != null && matchStr.length) > 0 ? matchStr : null) || noSpace
      );
    },
  );
  return sansOneBracketPair;
};

const TypeNameContextGetRoot = (
  node: RestLink.TypeNameContext | null,
): RestLink.TypeNameContext | null => {
  if (node == null || node.parent == null) {
    return node;
  }
  return TypeNameContextGetRoot(node.parent);
};
const TypeNameContextGetTypeName = (
  node: RestLink.TypeNameContext | null,
): string => {
  if (node == null) {
    throw new Error(
      "Can't search for a typename in the void. (TypeContext is null)",
    );
  }
  return node.__typename || TypeNameContextGetTypeName(node.parent);
};

const defaultTypePatcher: RestLink.FunctionalTypePatcher = (
  node: any,
  context: RestLink.TypeNameContext,
) => {
  if (Array.isArray(node)) {
    throw new Error(
      "Can't attach a typename to arrays. (should be handled before we get here!)",
    );
  } else if (typeof node != 'object') {
    throw new Error('Can only patch types for objects.');
  }
  const result = context.isSticky ? TypeNameContextGetTypeName(context) : null;
  return result;
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

/** Recursively descends the provided object tree and converts all the keys */
const convertObjectKeys = (
  object: object,
  converter: RestLink.FieldNameNormalizer,
  keypath: string[] = [],
): object => {
  let convert: RestLink.FieldNameNormalizer = null;
  if (converter.prototype.arity != 2) {
    convert = (name, keypath) => {
      return converter(name);
    };
  } else {
    convert = converter;
  }

  if (['string', 'number'].indexOf(typeof object) != -1) {
    // Object is a scalar, no keys to convert!
    return object;
  }

  return Object.keys(object)
    .filter(e => e !== '__typename')
    .reduce((acc: any, key: string) => {
      let value = object[key];
      const nestedKeyPath = keypath.concat([key]);
      if (Array.isArray(value)) {
        value = value.map(e => convertObjectKeys(e, converter, nestedKeyPath));
      } else if (typeof value === 'object') {
        value = convertObjectKeys(value, converter, nestedKeyPath);
      }
      acc[convert(key, nestedKeyPath)] = value;
      return acc;
    }, {});
};

const noOpNameNormalizer: RestLink.FieldNameNormalizer = (name: string) => {
  return name;
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
      if (
        ['POST', 'PUT', 'PATCH', 'DELETE'].indexOf(method.toUpperCase()) !== -1
      ) {
        return;
      }
      throw new Error('"mutation" operations do not support that HTTP-verb');
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
  operationType: OperationTypeNode;
  fieldNameDenormalizer: RestLink.FieldNameNormalizer;
  typePatcher: RestLink.FunctionalTypePatcher;
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

  const currentNode = (root || {})[resultKey];
  if (root && directives && directives.export) {
    exportVariables[directives.export.as] = currentNode;
  }
  const isNotARestCall = !directives || !directives.rest;
  if (isLeaf || isNotARestCall) {
    return currentNode;
  }
  const {
    credentials,
    endpoints,
    headers,
    customFetch,
    operationType,
    typePatcher,
    fieldNameDenormalizer: linkLevelNameDenormalizer,
  } = context;
  const { path, endpoint } = directives.rest as RestLink.DirectiveOptions;
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
    let {
      method,
      type,
      bodyBuilder,
      bodyKey,
      fieldNameDenormalizer: perRequestNameDenormalizer,
    } = directives.rest as RestLink.DirectiveOptions;
    if (!method) {
      method = 'GET';
    }

    let body = null;
    if (
      -1 === ['GET', 'DELETE'].indexOf(method) &&
      operationType === 'mutation'
    ) {
      // Prepare our body!
      if (!bodyBuilder) {
        // By convention GraphQL recommends mutations having a single argument named "input"
        // https://dev-blog.apollodata.com/designing-graphql-mutations-e09de826ed97

        const maybeBody = argsWithExport[bodyKey || 'input'];
        if (!maybeBody) {
          throw new Error(
            '[GraphQL mutation using a REST call without a body]. No `input` was detected. Pass bodyKey, or bodyBuilder to the @rest() directive to resolve this.',
          );
        }

        bodyBuilder = (argsWithExport: object) => {
          return maybeBody;
        };
      }
      body = convertObjectKeys(
        bodyBuilder(argsWithExport),
        perRequestNameDenormalizer ||
          linkLevelNameDenormalizer ||
          noOpNameNormalizer,
      );
    }

    validateRequestMethodForOperationType(method, operationType || 'query');

    const typeContext: RestLink.TypeNameContext = {
      __typename: type,
      isSticky: true,
      isArray: false,
      parent: null,
      key: null,
    };

    return await (customFetch || fetch)(`${uri}${pathWithParams}`, {
      credentials,
      method,
      headers,
      body,
    })
      .then(res => res.json())
      .then(result =>
        recursivelyPatchTypes(
          result,
          { ...typeContext, isArray: Array.isArray(result) },
          typePatcher,
        ),
      );
  } catch (error) {
    throw error;
  }
};

const recursivelyPatchTypes = (
  result: any,
  typeContext: RestLink.TypeNameContext,
  typePatcher,
): any => {
  if (result == null) {
    return result;
  }
  if (
    ['string', 'symbol', 'number', 'undefined', 'function'].indexOf(
      typeof result,
    ) !== -1
  ) {
    return result;
  }
  if (Array.isArray(result)) {
    typeContext.isArray = true;
    if (result.length == 0) {
      return [];
    }

    return result.map(inner => {
      return recursivelyPatchTypes(
        inner,
        {
          ...typeContext,
          parent: typeContext,
          isArray: false,
          key: null,
          __typename: typeContext.isSticky
            ? popOneSetOfArrayBracketsFromTypeName(typeContext.__typename)
            : null,
        },
        typePatcher,
      );
    });
  }

  const __typename = typePatcher(result, typeContext);
  const finalResultSeed = __typename != null ? { __typename } : {};

  const tmpContext = {
    ...typeContext,
    parent: typeContext,
    __typename: null,
    isSticky: false,
  };

  return Object.keys(result).reduce((nextResult, key) => {
    nextResult[key] = recursivelyPatchTypes(
      result[key],
      { ...tmpContext, key: key, isSticky: false },
      typePatcher,
    );
    return nextResult;
  }, finalResultSeed);
};

/**
 * Default key to use when the @rest directive omits the "endpoint" parameter.
 */
const DEFAULT_ENDPOINT_KEY = '';

/**
 * RestLink is an apollo-link for communicating with REST services using GraphQL on the client-side
 */
export class RestLink extends ApolloLink {
  static TypeNameContextGetRoot = TypeNameContextGetRoot;
  static TypeNameContextGetTypeName = TypeNameContextGetTypeName;

  private endpoints: RestLink.Endpoints;
  private headers: Headers;
  private fieldNameNormalizer: RestLink.FieldNameNormalizer;
  private fieldNameDenormalizer: RestLink.FieldNameNormalizer;
  private typePatcher: RestLink.FunctionalTypePatcher;
  private credentials: RequestCredentials;
  private customFetch: RestLink.CustomFetch;

  constructor({
    uri,
    endpoints,
    headers,
    fieldNameNormalizer,
    fieldNameDenormalizer,
    typePatcher,
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
    this.fieldNameDenormalizer = fieldNameDenormalizer || null;
    this.typePatcher = typePatcher || defaultTypePatcher;
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

    const operationType: OperationTypeNode =
      (getMainDefinition(query) || ({} as any)).operation || 'query';

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
          operationType,
          fieldNameDenormalizer: this.fieldNameDenormalizer,
          typePatcher: this.typePatcher,
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
