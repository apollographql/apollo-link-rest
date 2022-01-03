import React from "react";
import { Button, Flex, HStack, IconButton } from "@chakra-ui/react";
import { CloseIcon, DeleteIcon } from "@chakra-ui/icons";

const DetailHeader = ({ onClose }: any) => {
  return (
    <Flex w="full" justifyContent="space-between">
      <Button size="sm" fontWeight="normal" onClick={onClose} borderRadius="sm">
        Task-123456
      </Button>
      <HStack spacing={2}>
        <Button
          size="sm"
          fontWeight="normal"
          onClick={onClose}
          borderRadius="sm"
        >
          Give Feedback
        </Button>
        <Button
          size="sm"
          fontWeight="normal"
          onClick={onClose}
          borderRadius="sm"
        >
          Copy Link
        </Button>
        <IconButton aria-label="delete" icon={<DeleteIcon />} />
        <IconButton aria-label="close" icon={<CloseIcon />} />
      </HStack>
    </Flex>
  );
};

export default DetailHeader;
