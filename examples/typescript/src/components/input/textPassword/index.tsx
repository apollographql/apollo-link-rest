import React, { useState } from "react";
import {
  Input,
  InputGroup,
  InputRightElement,
  Button,
  IconButton
} from "@chakra-ui/react";
import { HiOutlineEye, HiOutlineEyeOff } from "react-icons/hi";

const TextPassword = (props: any) => {
  const {
    name,
    value,
    autoFocus,
    onChange2, // CHANGE FOR CONTROLLED COMPONENT IF IGNORED CONTROL OR NO CONTROL
    onChangeRHF // CHANGE FOR RHF
  } = props;

  const [show, setShow] = useState(false);

  const handleChange = (event: any) => {
    const { name, value } = event.target;
    onChangeRHF && onChangeRHF(value);
    onChange2 && onChange2(name, value);
  };
  const handleClick = () => setShow(!show);

  return (
    <InputGroup size="md">
      <Input
        id={name}
        onChange={handleChange}
        value={value && value}
        pr="4.5rem"
        type={show ? "text" : "password"}
        placeholder="Enter password"
        bg="white"
        border="1px"
        borderColor="gray.300"
        autoFocus={autoFocus}
      />
      <InputRightElement>
        <IconButton
          aria-label="show password"
          h="1.75rem"
          size="sm"
          onClick={handleClick}
          icon={show ? <HiOutlineEyeOff /> : <HiOutlineEye />}
        />
      </InputRightElement>
    </InputGroup>
  );
};

export default TextPassword;
