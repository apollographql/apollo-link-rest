const isObject = (o: any) => {
  return o === Object(o);
};

export const resolveObjectValueByPath = (o: any, s: string) => {
  s = s.replace(/\[(\w+)\]/g, ".$1");
  s = s.replace(/^\./, ""); //
  var a = s.split(".");
  for (var i = 0, n = a.length; i < n; ++i) {
    var k = a[i];
    if (isObject(o) && k in o) {
      o = o[k];
    } else {
      return;
    }
  }
  return o;
};

export default resolveObjectValueByPath;
