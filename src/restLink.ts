import {
  OperationTypeNode,
  OperationDefinitionNode,
  FragmentDefinitionNode,
  // Query Nodes
  DirectiveNode,
  FieldNode,
  SelectionSetNode,
} from 'graphql';
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
  getFragmentDefinitions,
  createFragmentMap,
  addTypenameToDocument,
  FragmentMap,
  isField,
  isInlineFragment,
  resultKeyNameFromField,
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

  /** injects __typename using user-supplied code */
  export interface FunctionalTypePatcher {
    (data: any, outerType: string, patchDeeper: FunctionalTypePatcher): any;
  }
  /** Table of mappers that help inject __typename per type described therein */
  export interface TypePatcherTable {
    [typename: string]: FunctionalTypePatcher;
  }

  export type CustomFetch = (
    request: RequestInfo,
    init: RequestInit,
  ) => Promise<Response>;

  /**
   * Used for any Error from the server when requests:
   * - terminate with HTTP Status >= 300
   * - and the response contains no data or errors
   */
  export type ServerError = Error & {
    response: Response;
    result: Promise<string>;
    statusCode: number;
  };

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
     *
     * @note This is called *before* @see typePatcher so that it happens after
     *       optional-field-null-insertion.
     */
    fieldNameNormalizer?: FieldNameNormalizer;

    /**
     * A function that takes a GraphQL-compliant field name and converts it back into an endpoint-specific name
     * Can be overridden at the mutation-call-site (in the rest-directive).
     */
    fieldNameDenormalizer?: FieldNameNormalizer;

    /**
     * Structure to allow you to specify the __typename when you have nested objects in your REST response!
     *
     * If you want to force Required Properties, you can throw an error in your patcher,
     *  or `delete` a field from the data response provided to your typePatcher function!
     *
     * @note: This is called *after* @see fieldNameNormalizer because that happens
     *        after optional-nulls insertion, and those would clobber normalized names.
     *
     * @warning: We're not thrilled with this API, and would love a better alternative before we get to 1.0.0
     *           Please see proposals considered in https://github.com/apollographql/apollo-link-rest/issues/48
     *           And consider submitting alternate solutions to the problem!
     */
    typePatcher?: TypePatcherTable;

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
    /**
     * What path (including query) to use
     * - @optional if you provide @see DirectiveOptions.pathBuilder
     */
    path?: string;
    /**
     * What endpoint to select from the map of endpoints available to this link.
     * @default `RestLink.endpoints[DEFAULT_ENDPOINT_KEY]`
     */
    endpoint?: string;
    /**
     * Function that constructs a request path out of the Environmental
     *  state when processing this @rest(...) call.
     *
     * - @optional if you provide: @see DirectiveOptions.path
     * - **note**: this does not do any URI encoding on the result, so be aware if you're
     *  making a query-string!
     */
    pathBuilder?: (args: object) => string;
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

const addTypeNameToResult = (
  result: any[] | object,
  __typename: string,
  typePatcher: RestLink.FunctionalTypePatcher,
): any[] | object => {
  if (Array.isArray(result)) {
    const fixedTypename = popOneSetOfArrayBracketsFromTypeName(__typename);
    // Recursion needed for multi-dimensional arrays
    return result.map(e => addTypeNameToResult(e, fixedTypename, typePatcher));
  }
  return typePatcher(result, __typename, typePatcher);
};

const quickFindRestDirective = (field: FieldNode): DirectiveNode | null => {
  if (field.directives && field.directives.length) {
    return field.directives.find(directive => 'rest' === directive.name.value);
  }
  return null;
};
/**
 * The way graphql works today, it doesn't hand us the AST tree for our query, it hands us the ROOT
 * This method searches for REST-directive-attached nodes that are named to match this query.
 *
 * A little bit of wasted compute, but alternative would be a patch in graphql-anywhere.
 *
 * @param resultKey SearchKey for REST directive-attached item matching this sub-query
 * @param current current node in the REST-JSON-response
 * @param mainDefinition Parsed Query Definition
 * @param fragmentMap Map of Named Fragments
 * @param currentSelectionSet Current selection set we're filtering by
 */
function findRestDirectivesThenInsertNullsForOmittedFields(
  resultKey: string,
  current: any[] | object, // currentSelectionSet starts at root, so wait until we're inside a Field tagged with an @rest directive to activate!
  mainDefinition: OperationDefinitionNode | FragmentDefinitionNode,
  fragmentMap: FragmentMap,
  currentSelectionSet: SelectionSetNode,
): any[] | object {
  if (current == null || currentSelectionSet == null) {
    return current;
  }
  currentSelectionSet.selections.forEach(node => {
    if (isInlineFragment(node)) {
      findRestDirectivesThenInsertNullsForOmittedFields(
        resultKey,
        current,
        mainDefinition,
        fragmentMap,
        node.selectionSet,
      );
    } else if (node.kind === 'FragmentSpread') {
      const fragment = fragmentMap[node.name.value];
      findRestDirectivesThenInsertNullsForOmittedFields(
        resultKey,
        current,
        mainDefinition,
        fragmentMap,
        fragment.selectionSet,
      );
    } else if (isField(node)) {
      const name = resultKeyNameFromField(node);
      if (name === resultKey && quickFindRestDirective(node) != null) {
        // Jackpot! We found our selectionSet!
        insertNullsForAnyOmittedFields(
          current,
          mainDefinition,
          fragmentMap,
          node.selectionSet,
        );
      } else {
        findRestDirectivesThenInsertNullsForOmittedFields(
          resultKey,
          current,
          mainDefinition,
          fragmentMap,
          node.selectionSet,
        );
      }
    } else {
      // This will give a TypeScript build-time error if you did something wrong or the AST changes!
      return ((node: never): never => {
        throw new Error('Unhandled Node Type in SelectionSetNode.selections');
      })(node);
    }
  });
  // Return current to have our result pass to next link in async promise chain!
  return current;
}
/**
 * Recursively walks a handed object in parallel with the Query SelectionSet,
 *  and inserts `null` for any field that is missing from the response.
 *
 * This is needed because ApolloClient will throw an error automatically if it's
 *  missing -- effectively making all of rest-link's selections implicitly non-optional.
 *
 * If you want to implement required fields, you need to use typePatcher to *delete*
 *  fields when they're null and you want the query to fail instead.
 *
 * @param current Current object we're patching
 * @param mainDefinition Parsed Query Definition
 * @param fragmentMap Map of Named Fragments
 * @param currentSelectionSet Current selection set we're filtering by
 */
function insertNullsForAnyOmittedFields(
  current: any[] | object, // currentSelectionSet starts at root, so wait until we're inside a Field tagged with an @rest directive to activate!
  mainDefinition: OperationDefinitionNode | FragmentDefinitionNode,
  fragmentMap: FragmentMap,
  currentSelectionSet: SelectionSetNode,
): void {
  if (current == null || currentSelectionSet == null) {
    return;
  }
  if (Array.isArray(current)) {
    // If our current value is an array, process our selection set for each entry.
    current.forEach(c =>
      insertNullsForAnyOmittedFields(
        c,
        mainDefinition,
        fragmentMap,
        currentSelectionSet,
      ),
    );
    return;
  }
  currentSelectionSet.selections.forEach(node => {
    if (isInlineFragment(node)) {
      insertNullsForAnyOmittedFields(
        current,
        mainDefinition,
        fragmentMap,
        node.selectionSet,
      );
    } else if (node.kind === 'FragmentSpread') {
      const fragment = fragmentMap[node.name.value];
      insertNullsForAnyOmittedFields(
        current,
        mainDefinition,
        fragmentMap,
        fragment.selectionSet,
      );
    } else if (isField(node)) {
      const value = current[node.name.value];
      if (node.name.value === '__typename') {
        // Don't mess with special fields like __typename
      } else if (typeof value === 'undefined') {
        // Patch in a null where the field would have been marked as missing
        current[node.name.value] = null;
      } else if (
        value != null &&
        typeof value === 'object' &&
        node.selectionSet != null
      ) {
        insertNullsForAnyOmittedFields(
          value,
          mainDefinition,
          fragmentMap,
          node.selectionSet,
        );
      } else {
        // Other types (string, number) do not need recursive patching!
      }
    } else {
      // This will give a TypeScript build-time error if you did something wrong or the AST changes!
      return ((node: never): never => {
        throw new Error('Unhandled Node Type in SelectionSetNode.selections');
      })(node);
    }
  });
}

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
  if (value === undefined || name === undefined) {
    return endpoint;
  }
  return endpoint.replace(`:${name}`, value);
};

/**
 * Some keys should be passed through transparently without normalizing/de-normalizing
 */
const noMangleKeys = ['__typename'];

/** Recursively descends the provided object tree and converts all the keys */
const convertObjectKeys = (
  object: object,
  __converter: RestLink.FieldNameNormalizer,
  keypath: string[] = [],
): object => {
  let converter: RestLink.FieldNameNormalizer = null;
  if (__converter.length != 2) {
    converter = (name, keypath) => {
      return __converter(name);
    };
  } else {
    converter = __converter;
  }

  if (object == null || typeof object !== 'object') {
    // Object is a scalar or null / undefined => no keys to convert!
    return object;
  }

  if (Array.isArray(object)) {
    return object.map((o, index) =>
      convertObjectKeys(o, converter, [...keypath, String(index)]),
    );
  }

  return Object.keys(object).reduce((acc: any, key: string) => {
    let value = object[key];

    if (noMangleKeys.indexOf(key) !== -1) {
      acc[key] = value;
      return acc;
    }

    const nestedKeyPath = [...keypath, key];
    acc[converter(key, nestedKeyPath)] = convertObjectKeys(
      value,
      converter,
      nestedKeyPath,
    );
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
export const overrideHeadersMergePolicy = (
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
export const overrideHeadersMergePolicyHelper = overrideHeadersMergePolicy; // Deprecated name

const makeOverrideHeadersMergePolicy = (
  headersToOverride: string[],
): RestLink.HeadersMergePolicy => {
  return (linkHeaders, requestHeaders) => {
    return overrideHeadersMergePolicy(
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

/**
 * Utility to build & throw a JS Error from a "failed" REST-response
 * @param response: HTTP Response object for this request
 * @param result: Promise that will render the body of the response
 * @param message: Human-facing error message
 */
const rethrowServerSideError = (
  response: Response,
  result: Promise<string>,
  message: string,
) => {
  const error = new Error(message) as RestLink.ServerError;

  error.response = response;
  error.statusCode = response.status;
  error.result = result;

  throw error;
};

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

  /** An array of the responses from each fetched URL, useful for accessing headers in earlier links */
  restResponses?: Response[];
}

/** Context passed via graphql() to our resolver */
interface RequestContext {
  /** Headers the user wants to set on this request. See also headersMergePolicy */
  headers: Headers;

  /** Credentials Policy for Fetch */
  credentials?: RequestCredentials | null;

  /** Exported variables fulfilled in this request, using @export(as:) */
  exportVariables: { [key: string]: any };

  endpoints: RestLink.Endpoints;
  customFetch: RestLink.CustomFetch;
  operationType: OperationTypeNode;
  fieldNameNormalizer: RestLink.FieldNameNormalizer;
  fieldNameDenormalizer: RestLink.FieldNameNormalizer;
  mainDefinition: OperationDefinitionNode | FragmentDefinitionNode;
  fragmentDefinitions: FragmentDefinitionNode[];
  typePatcher: RestLink.FunctionalTypePatcher;

  /** An array of the responses from each fetched URL */
  responses: Response[];
}

const addTypeToNode = (node, typename) => {
  if (node === null || node === undefined || typeof node !== 'object') {
    return node;
  }

  if (!Array.isArray(node)) {
    node['__typename'] = typename;
    return node;
  }

  return node.map(item => {
    return addTypeToNode(item, typename);
  });
};

const resolver: Resolver = async (
  fieldName: string,
  root: any,
  args: any,
  context: RequestContext,
  info: ExecInfo,
) => {
  const { directives, isLeaf, resultKey } = info;
  const { exportVariables } = context;

  // Support GraphQL Aliases!
  const aliasedNode = (root || {})[resultKey];
  const preAliasingNode = (root || {})[fieldName];

  if (root && directives && directives.export) {
    // @export(as:) is only supported with apollo-link-rest at this time
    // so use the preAliasingNode as we're responsible for implementing aliasing!
    exportVariables[directives.export.as] = preAliasingNode;
  }

  const isATypeCall = directives && directives.type;

  if (!isLeaf && isATypeCall) {
    // @type(name: ) is only supported inside apollo-link-rest at this time
    // so use the preAliasingNode as we're responsible for implementing aliasing!
    // Also: exit early, since @type(name: ) && @rest() can't both exist on the same node.
    if (directives.rest) {
      throw new Error(
        'Invalid use of @type(name: ...) directive on a call that also has @rest(...)',
      );
    }
    return addTypeToNode(preAliasingNode, directives.type.name);
  }

  const isNotARestCall = !directives || !directives.rest;
  if (isLeaf || isNotARestCall) {
    // This is a leaf API call, it's not tagged with @rest()
    // This might not belong to us so return the aliasNode version preferentially
    return aliasedNode || preAliasingNode;
  }
  const {
    credentials,
    endpoints,
    headers,
    customFetch,
    operationType,
    typePatcher,
    mainDefinition,
    fragmentDefinitions,
    fieldNameNormalizer,
    fieldNameDenormalizer: linkLevelNameDenormalizer,
  } = context;

  const fragmentMap = createFragmentMap(fragmentDefinitions);

  let {
    path,
    endpoint,
    pathBuilder,
  } = directives.rest as RestLink.DirectiveOptions;
  const uri = getURIFromEndpoints(endpoints, endpoint);
  try {
    const argsWithExport = { ...args, ...exportVariables };

    const bothPathsProvided = path != null && pathBuilder != null;
    const neitherPathsProvided = path == null && pathBuilder == null;

    if (bothPathsProvided || neitherPathsProvided) {
      const pathBuilderState = bothPathsProvided
        ? 'both, please remove one!'
        : 'neither, please add one!';
      throw new Error(
        `One and only one of ("path" | "pathBuilder") must be set in the @rest() directive. ` +
          `This request had ${pathBuilderState}`,
      );
    }
    if (!pathBuilder) {
      pathBuilder = (args: object): string => {
        const pathWithParams = Object.keys(args).reduce(
          (acc, e) => replaceParam(acc, e, args[e]),
          path,
        );
        if (pathWithParams.includes(':')) {
          throw new Error(
            'Missing parameters to run query, specify it in the query params or use ' +
              'an export directive. (If you need to use ":" inside a variable string' +
              ' make sure to encode the variables properly using `encodeURIComponent' +
              '`. Alternatively see documentation about using pathBuilder.)',
          );
        }
        return pathWithParams;
      };
    }
    const pathWithParams = pathBuilder(argsWithExport);

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

    let body = undefined;
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
    return await (customFetch || fetch)(`${uri}${pathWithParams}`, {
      credentials,
      method,
      headers,
      body: body && JSON.stringify(body),
    })
      .then(async res => {
        if (res.status >= 300) {
          // Throw a JSError, that will be available under the
          // "Network error" category in apollo-link-error
          let parsed: any;
          try {
            parsed = await res.json();
          } catch (error) {
            // its not json
            parsed = await res.text();
          }
          rethrowServerSideError(
            res,
            parsed,
            `Response not successful: Received status code ${res.status}`,
          );
        }
        return res;
      })
      .then(res => {
        context.responses.push(res);
        // HTTP-204 means "no-content", similarly Content-Length implies the same
        // This commonly occurs when you POST/PUT to the server, and it acknowledges
        // success, but doesn't return your Resource.
        return res.status === 204 || res.headers.get('Content-Length') === '0'
          ? Promise.resolve({})
          : res.json();
      })
      .then(
        result =>
          fieldNameNormalizer == null
            ? result
            : convertObjectKeys(result, fieldNameNormalizer),
      )
      .then(result =>
        findRestDirectivesThenInsertNullsForOmittedFields(
          resultKey,
          result,
          mainDefinition,
          fragmentMap,
          mainDefinition.selectionSet,
        ),
      )
      .then(result => addTypeNameToResult(result, type, typePatcher));
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
      this.endpoints[DEFAULT_ENDPOINT_KEY] = uri;
    }

    if (this.endpoints[DEFAULT_ENDPOINT_KEY] == null) {
      console.warn(
        'RestLink configured without a default URI. All @rest(…) directives must provide an endpoint key!',
      );
    }

    if (typePatcher == null) {
      this.typePatcher = (result, __typename, _2) => {
        return { __typename, ...result };
      };
    } else if (
      !Array.isArray(typePatcher) &&
      typeof typePatcher === 'object' &&
      Object.keys(typePatcher)
        .map(key => typePatcher[key])
        .reduce(
          // Make sure all of the values are patcher-functions
          (current, patcher) => current && typeof patcher === 'function',
          true,
        )
    ) {
      const table: RestLink.TypePatcherTable = typePatcher;
      this.typePatcher = (
        data: any,
        outerType: string,
        patchDeeper: RestLink.FunctionalTypePatcher,
      ) => {
        const __typename = data.__typename || outerType;
        if (Array.isArray(data)) {
          return data.map(d => patchDeeper(d, __typename, patchDeeper));
        }
        const subPatcher = table[__typename] || (result => result);
        return {
          __typename,
          ...subPatcher(data, __typename, patchDeeper),
        };
      };
    } else {
      throw new Error(
        'RestLink was configured with a typePatcher of invalid type!',
      );
    }

    this.fieldNameNormalizer = fieldNameNormalizer || null;
    this.fieldNameDenormalizer = fieldNameDenormalizer || null;
    this.headers = normalizeHeaders(headers);
    this.credentials = credentials || null;
    this.customFetch = customFetch;
  }

  public request(
    operation: Operation,
    forward?: NextLink,
  ): Observable<FetchResult> | null {
    const { query, variables, getContext, setContext } = operation;
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

    const mainDefinition = getMainDefinition(query);
    const fragmentDefinitions = getFragmentDefinitions(query);

    const operationType: OperationTypeNode =
      (mainDefinition || ({} as any)).operation || 'query';

    const requestContext: RequestContext = {
      headers,
      endpoints: this.endpoints,
      // Provide an empty hash for this request's exports to be stuffed into
      exportVariables: {},
      credentials,
      customFetch: this.customFetch,
      operationType,
      fieldNameNormalizer: this.fieldNameNormalizer,
      fieldNameDenormalizer: this.fieldNameDenormalizer,
      mainDefinition,
      fragmentDefinitions,
      typePatcher: this.typePatcher,
      responses: [],
    };
    const resolverOptions = {};
    return new Observable(observer => {
      graphql(
        resolver,
        queryWithTypename,
        null,
        requestContext,
        variables,
        resolverOptions,
      )
        .then(data => {
          setContext({
            restResponses: (context.restResponses || []).concat(
              requestContext.responses,
            ),
          });
          observer.next({ data });
          observer.complete();
        })
        .catch(err => {
          if (err.name === 'AbortError') return;
          if (err.result && err.result.errors) {
            observer.next(err.result);
          }
          observer.error(err);
        });
    });
  }
}
