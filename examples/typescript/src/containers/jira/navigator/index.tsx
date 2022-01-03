import React from "react";
import { Box, VStack, Text, HStack, Divider } from "@chakra-ui/react";
import { Link } from "react-router-dom";
import { CalendarIcon, SettingsIcon } from "@chakra-ui/icons";

const Navigator = () => {
  const lowerMenus = [
    "Releases",
    "Issues and filters",
    "Pages",
    "Reports",
    "Components"
  ];
  return (
    <VStack
      borderRight="1px"
      borderColor="gray.200"
      left={14}
      bg="gray.50"
      px={4}
      py={6}
      w={56}
      h="100vh"
      flexShrink={0}
      spacing={6}
      alignItems="Start"
    >
      <HStack alignItems="center" spacing={2}>
        <Box flexShrink={0} h={10} w={10} borderRadius="xl" bg="gray.400"></Box>
        <Box>
          <Text fontSize="sm">Singularity 1.0</Text>
          <Text fontSize="xs">Software Project</Text>
        </Box>
      </HStack>
      <Box w="full">
        <Link to="/board">
          <HStack
            cursor="pointer"
            spacing={3}
            p={3}
            borderRadius="sm"
            _hover={{ bg: "gray.200" }}
          >
            <CalendarIcon color="gray.600" h={4} w={4} />
            <Text color="gray.900" fontSize="sm">
              Kanban Board
            </Text>
          </HStack>
        </Link>
        <Link to="/settings">
          <HStack
            cursor="pointer"
            spacing={3}
            p={3}
            borderRadius="sm"
            _hover={{ bg: "gray.200" }}
          >
            <SettingsIcon color="gray.600" h={4} w={4} />
            <Text color="gray.900" fontSize="sm">
              Project Settings
            </Text>
          </HStack>
        </Link>
      </Box>
      <Divider borderColor="gray.400" />
      <Box w="full">
        {lowerMenus.map((menu, idx: number) => {
          return (
            <HStack
              cursor="pointer"
              key={idx}
              spacing={3}
              px={3}
              py={2}
              borderRadius="sm"
              _hover={{ bg: "gray.200" }}
            >
              <Box
                h={5}
                w={5}
                borderRadius="sm"
                flexShrink={0}
                bg="gray.400"
              ></Box>
              <Text fontSize="sm">{menu}</Text>
            </HStack>
          );
        })}
      </Box>
    </VStack>
  );
};

export default Navigator;
