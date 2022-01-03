import React from "react";
import {
  Modal,
  ModalCloseButton,
  ModalContent,
  ModalHeader,
  ModalOverlay
} from "@chakra-ui/react";

import CreateIssueForm from "./form";

export const CreateIssueModal = ({ isOpen, onClose }) => {
  return (
    <Modal size="3xl" isOpen={isOpen} onClose={onClose}>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Create Issue</ModalHeader>
        <ModalCloseButton />
        <CreateIssueForm onClose={onClose} />
      </ModalContent>
    </Modal>
  );
};

export default CreateIssueModal;
