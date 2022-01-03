import React from "react";
import { RadioGroup, RadioGroupProps } from "@chakra-ui/react";

import { Radio, Stack } from "@chakra-ui/react";

const RigoRadioGroup: React.FunctionComponent<any> = (props) => {
  let {
    name,
    error,
    value,
    options,
    direction,
    onChange2,
    onChangeRHF,
    inputName,
    ...rest
  } = props;

  const handleChange = (value: string) => {
    if (options) {
      let completeValue = options.find((f: any) => f.value == value);
      onChange2 && onChange2(name, completeValue);
      onChangeRHF && onChangeRHF(completeValue);
    }
  };

  return (
    <RadioGroup
      {...rest}
      value={value && (value.value || value)}
      onChange={handleChange}
    >
      <Stack direction={direction || "row"}>
        {options &&
          options.map((item: any, index: number) => (
            <React.Fragment key={`${index}`}>
              <Radio colorScheme="blue" key={index} value={item.value}>
                {item.label}
              </Radio>
              <span style={{ marginRight: "2rem" }} />
            </React.Fragment>
          ))}
      </Stack>
    </RadioGroup>
  );
};

export default RigoRadioGroup;
