import React, { useEffect } from "react";
import { Box, Slide, VStack, Flex, useDisclosure } from "@chakra-ui/react";
import { AddIcon, QuestionOutlineIcon, SearchIcon } from "@chakra-ui/icons";

const Sidebar = ({ handleOpenCreateIssueModal }: any) => {
  return (
    <Flex
      direction="column"
      alignItems="center"
      justifyContent="space-between"
      bg="brand.primary"
      w={14}
      h="100vh"
      flexShrink={0}
    >
      <VStack pb={12} pt={5} alignItems="center" spacing={5}>
        <Box bg="gray.100" h={6} w={6} borderRadius="full"></Box>
        <AddIcon
          onClick={handleOpenCreateIssueModal}
          h={5}
          w={5}
          color="gray.100"
        />
        <SearchIcon h={5} w={5} color="gray.100" />
      </VStack>
      <Flex py={5} direction="column" alignItems="center">
        <QuestionOutlineIcon h={5} w={5} color="gray.100" />
      </Flex>
    </Flex>
  );
};

export default Sidebar;
