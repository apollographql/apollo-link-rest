import React from "react";
import { ChakraProvider } from "@chakra-ui/react";

export const PzProvider = (props) => {
  return <ChakraProvider {...props}>{props.children}</ChakraProvider>;
};
