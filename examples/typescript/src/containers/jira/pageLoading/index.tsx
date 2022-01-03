import { Flex, Spinner } from "@chakra-ui/react";
import React from "react";
const PageLoading = () => {
  return (
    <Flex justifyContent="center" alignItems="center" w="full" h="100vh">
      <Spinner color="brand.primary" />
    </Flex>
  );
};

export default PageLoading;
