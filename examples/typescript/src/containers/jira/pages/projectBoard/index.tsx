import React from "react";
import {
  Box,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  Heading,
  Button,
  Flex,
  Input,
  InputGroup,
  InputLeftElement,
  Avatar,
  AvatarGroup,
  HStack,
  useDisclosure
} from "@chakra-ui/react";
import { SearchIcon } from "@chakra-ui/icons";
import Column from "./column";
import IssueDetailModal from "../../issueDetailModal";

const data = [
  {
    id: 1,
    title: "BACKLOG 2",
    items: [
      {
        id: 1,
        description: "This is an issue of type: Task."
      },

      {
        id: 6,
        description:
          "Each issue can be assigned priority from lowest to highest."
      }
    ]
  },
  {
    id: 2,
    title: "SELECTED FOR DEVELOPMENT 2",
    items: [
      {
        id: 2,
        description: "Try leaving a comment on this issue."
      },
      {
        id: 5,
        description:
          "Try dragging issues to different columns to transition their status."
      }
    ]
  },
  {
    id: 3,
    title: "IN PROGRESS 1",
    items: [
      {
        id: 3,
        description: "You can use rich text with images in issue descriptions."
      },
      {
        id: 8,
        description:
          "You can track how many hours were spent working on an issue, and how many hours remain."
      }
    ]
  },
  {
    id: 4,
    title: "DONE 1",
    items: [
      {
        id: 4,
        description: "Click on an issue to see what's behind it."
      },
      {
        id: 7,
        description:
          "Each issue has a single reporter but can have multiple assignees."
      },
      {
        id: 9,
        description: "Click on an issue to see what's behind it."
      },
      {
        id: 10,
        description:
          "Each issue has a single reporter but can have multiple assignees."
      },
      {
        id: 11,
        description: "Click on an issue to see what's behind it."
      },
      {
        id: 12,
        description:
          "Each issue has a single reporter but can have multiple assignees."
      }
    ]
  }
];

const ProjectBoard = () => {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const handleOpenIssueDetailModal = () => onOpen();
  return (
    <>
      <Box h="100vh" p={8} minHeight="100vh" overflowY="auto" flex={1}>
        <Breadcrumb>
          <BreadcrumbItem>
            <BreadcrumbLink fontSize="sm" href="#">
              Projects
            </BreadcrumbLink>
          </BreadcrumbItem>

          <BreadcrumbItem>
            <BreadcrumbLink fontSize="sm" href="#">
              Singularity 1.0
            </BreadcrumbLink>
          </BreadcrumbItem>

          <BreadcrumbItem isCurrentPage>
            <BreadcrumbLink fontSize="sm" href="#">
              Kanban board
            </BreadcrumbLink>
          </BreadcrumbItem>
        </Breadcrumb>

        <Flex alignItems="center" justifyContent="space-between">
          <Heading fontSize="24px" fontWeight="medium" lineHeight="short">
            Kanban Board
          </Heading>
          <Button bg="white" fontSize="sm" fontWeight="normal">
            Github Repo
          </Button>
        </Flex>

        <HStack spacing={3} mt={6} alignItems="center">
          <InputGroup w={44} size="sm">
            <InputLeftElement
              pointerEvents="none"
              children={<SearchIcon color="gray.300" />}
            />
            <Input type="text" />
          </InputGroup>
          <AvatarGroup size="sm" max={2}>
            <Avatar name="Ryan Florence" src="https://bit.ly/ryan-florence" />
            <Avatar name="Segun Adebayo" src="https://bit.ly/sage-adebayo" />
            <Avatar name="Kent Dodds" src="https://bit.ly/kent-c-dodds" />
            <Avatar
              name="Prosper Otemuyiwa"
              src="https://bit.ly/prosper-baba"
            />
            <Avatar name="Christian Nwamba" src="https://bit.ly/code-beast" />
          </AvatarGroup>
          <Button bg="white" size="sm" fontWeight="normal" fontSize="sm">
            Only My Issues
          </Button>
          <Button bg="white" size="sm" fontWeight="normal" fontSize="sm">
            Recently Updated
          </Button>
        </HStack>

        <HStack mt={6} spacing={3} alignItems="stretch" w="full">
          {data.map((d, idx) => {
            return (
              <Column
                handleOpenIssueDetailModal={handleOpenIssueDetailModal}
                key={`column-${d.id}`}
                data={d}
              />
            );
          })}
        </HStack>
      </Box>
      <IssueDetailModal isOpen={isOpen} onClose={onClose} />
    </>
  );
};

export default ProjectBoard;
