export const regex = {
  email: /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/,

  phoneNumber: /^((\\+)|(00)|(\\*)|())[0-9]{3,14}((\\#)|())$/,

  numberAndDecimals: /^([0-9]\d*)(\.\d+)?$/,

  numbersOnly: /^([0-9]\d*)?$/,

  positiveNumber: /^([1-9]\d*)?$/

  //  numberToNepaliCurrency = (number) => {
  //     let rst = parseFloat(number)
  //       .toFixed(2)
  //       // .replace(/\D/g, "")
  //       .replace(/(\d+?)(?=(\d\d)+(\d)(?!\d))(\.\d+)?/g, "$1,");

  //     return rst;
  //   },

  //    isHtml = (htmlString: string) => {
  //     let re = /(<([^>]+)>)/i; // new RegExp("<([A-Za-z][A-Za-z0-9]*)\b[^>]*>(.*?)</\1>"); // /^(</?\w+((\s+\w+(\s*=\s*(?:".*?"|'.*?'|[\^'">\s]+))?)+\s*|\s*)/?>)$/;
  //     return re.test(htmlString);
  //   },

  //  isDevanagariUnicode = (testString) => {
  //     let lettersOnly = testString.replace(/\s/g, ""); //remove spaces
  //     let isDevanagari = true;

  //     for (let i = 0; i < lettersOnly.length; i++) {
  //       let code = lettersOnly.charCodeAt(i);
  //       if (code < 0x0900 || code > 0x097f) {
  //         isDevanagari = false;
  //         break;
  //       }
  //     }
  //     return isDevanagari;
  //   }
};

export const RegexValidation = (regexType: any, value: any) => {
  return regexType.test(value);
};
