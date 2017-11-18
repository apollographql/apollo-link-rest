import { ApolloLink, Observable } from "apollo-link";
import { filterObjectWithKeys, ArrayToObject } from './utils';

// assuming arguments are always typename and endPoint in this order
const getTypeName = selection => selection.directives[0].arguments[0].value.value;
const getEndPoint = selection => selection.directives[0].arguments[1].value.value;

const getSelectionName = selection => selection.name.value;
const getResultKeys = selection => selection.selectionSet.selections.map(({ name }) => name.value);

const getQueryParams = selection => 
  selection.arguments.map(p => ({
    name: p.name.value,
    value: p.value.value
  }));

const replaceParam = (endPoint, name, value) => {
  if(!value || !name) {
    return endPoint;
  }
  return endPoint.replace(`:${name}`, value)
}

const replaceParamsInsideEndPoints = (queryParams, endPoint, variables) => {
  const endPointWithQueryParams = queryParams.reduce((acc, { name, value }) => replaceParam(acc, name, value), endPoint);
  const endPointWithInputVariables = Object.keys(variables).reduce((acc, e) => replaceParam(acc, e, variables[e]), endPointWithQueryParams);
  return endPointWithInputVariables;
};

const getRequests = (selections, variables, uri) =>
  selections.map(selection => {
    const selectionName = getSelectionName(selection);
    const resKeys = getResultKeys(selection); 
    const endPoint = getEndPoint(selection);
    const __typename = getTypeName(selection);
    const queryParams = getQueryParams(selection);
    const endPointWithParams = replaceParamsInsideEndPoints(queryParams, endPoint, variables);

    return {
      name: selectionName,
      filteredKeys: resKeys,
      endPoint: `${uri}${endPointWithParams}`,
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

const processRequest = ({ name, filteredKeys, endPoint, __typename }) =>
  new Promise((resolve, reject) => {
    fetch(endPoint)
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

class RestAPILink extends ApolloLink {
  constructor({ uri }) {
    super();
    this.uri = uri;
  }

  request(operation) {
    return new Observable(observer => {
      // for now doing query only
      const queryDefinition = operation.query.definitions[0];
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

export default RestAPILink;
