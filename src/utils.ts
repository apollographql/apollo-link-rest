export const ArrayToObject = array =>
  array.reduce((result, elem) => ({ ...result, ...elem }), {});

export const filterObjectWithKeys = (obj, keys) =>
  keys.reduce((acc, e) => {
    acc[e] = obj[e];
    return acc;
  }, {});
