import React from "react";
import { Textarea } from "@chakra-ui/react";

export const TextArea = (props: any) => {
  let {
    name,
    error,
    value,
    onChange2,
    onChangeRHF,
    inputName,
    ...rest
  } = props;
  const handleChange = (e: any) => {
    let { name, value } = e.target;
    onChange2 && onChange2(name, value);
    onChangeRHF && onChangeRHF(value);
  };

  return (
    <Textarea
      {...rest}
      name={name}
      value={value}
      onChange={handleChange}
      autoFocus={props.autoFocus}
      borderColor={error ? "red.500" : "gray.300"}
      _focus={{
        borderColor: error ? "red.500" : "blue.500"
      }}
    />
  );
};
