import React from "react";
import { Input } from "@chakra-ui/input";

const TextInput = (props: any) => {
  let { name, value, onChange2, onChangeRHF, customLabel, ...rest } = props; // remove custom props and spread rest
  const handleChange = (e: any) => {
    let { name, value } = e.target;
    onChange2 && onChange2(name, value);
    onChangeRHF && onChangeRHF(value);
  };

  return <Input {...rest} name={name} value={value} onChange={handleChange} />;
};

export default TextInput;
