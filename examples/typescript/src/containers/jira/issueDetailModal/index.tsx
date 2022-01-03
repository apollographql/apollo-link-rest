import React from "react";
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  Box,
  Button,
  Flex,
  HStack,
  IconButton
} from "@chakra-ui/react";

import DetailHeader from "./header";
import DetailBody from "./body";
const IssueDetailModal = ({ isOpen, onClose }: any) => {
  return (
    <Modal size="3xl" isOpen={isOpen} onClose={onClose}>
      <ModalOverlay />
      <ModalContent>
        <ModalBody px={10} py={8}>
          <DetailHeader />
          <DetailBody />
        </ModalBody>
      </ModalContent>
    </Modal>
  );
};
export default IssueDetailModal;
