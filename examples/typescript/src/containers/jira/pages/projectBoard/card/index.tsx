import React from "react";
import { Box, Text, Flex, HStack, Avatar } from "@chakra-ui/react";
import { ArrowUpIcon, CheckCircleIcon } from "@chakra-ui/icons";

const Card = (props: any) => {
  const {
    data: { description },
    handleOpenIssueDetailModal
  } = props;
  return (
    <Box
      onClick={handleOpenIssueDetailModal}
      w="full"
      cursor="pointer"
      bg="white"
      p={3}
      borderRadius="sm"
      shadow="sm"
      _hover={{ bg: "gray.50" }}
    >
      <Text fontSize="sm">{description}</Text>
      <Flex justifyContent="space-between" mt={3} alignItems="center">
        <HStack spacing={1}>
          {/* <Box h={3} w={3} borderRadius="full" bg="gray.200"></Box> */}
          <CheckCircleIcon h={4} w={4} color="blue.500" />
          <ArrowUpIcon h={4} w={4} color="red.500" />
        </HStack>
        {/* <Box h={6} w={6} borderRadius="full" bg="gray.200"></Box> */}
        <Avatar
          size="xs"
          name="Dan Abrahmov"
          src="https://bit.ly/dan-abramov"
        />
      </Flex>
    </Box>
  );
};

export default Card;
