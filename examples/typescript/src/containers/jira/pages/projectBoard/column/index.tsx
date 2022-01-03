import React from "react";
import { Box, Text, Flex, HStack, VStack } from "@chakra-ui/react";
import Card from "../card";

const Column = (props: any) => {
  const {
    data: { title, items },
    handleOpenIssueDetailModal
  } = props;
  return (
    <Box w={1 / 4} bg="gray.100" minHeight={96}>
      <Box px={2} py={3}>
        <Text textTransform="uppercase" fontSize="xs">
          {title}
        </Text>
      </Box>
      <VStack p={1} spacing={2}>
        {items.map((item, idx: number) => {
          return (
            <Card
              handleOpenIssueDetailModal={handleOpenIssueDetailModal}
              key={`card-${item.id}`}
              data={item}
            />
          );
        })}
      </VStack>
    </Box>
  );
};

export default Column;
