import React from "react";
import {
  Box,
  Text,
  Button,
  FormLabel,
  HStack,
  ModalBody,
  ModalFooter,
  VStack,
  Divider
} from "@chakra-ui/react";
import { FProvider, ConnectForm } from "../../../../components/formProvider";
import Input from "../../../../components/input";

const INITIAL_FORM_DATA = {
  issueType: {
    label: "Task",
    value: 1
  },
  shortSummary: "This is short summary",
  description:
    "Plan, track, and manage your agile and software development projects in Jira. Customize your workflow, collaborate, and release great software.",
  reporter: {
    label: "Lord Gaben",
    value: 1
  },
  assignees: {
    label: "Lord Gaben",
    value: 1
  },
  priority: {
    label: "Highest",
    value: 1
  }
};

const ISSUE_TYPE_OPTION = [
  {
    label: "Task",
    value: 1
  },
  {
    label: "Story",
    value: 2
  },
  {
    label: "Bug",
    value: 3
  }
];
const REPORTER_OPTION = [
  {
    label: "Lord Gaben",
    value: 1
  },
  {
    label: "Pickel Rick",
    value: 2
  },
  {
    label: "Baby Yoda",
    value: 3
  }
];
const PRIORITY_OPTION = [
  {
    label: "Highest",
    value: 1
  },
  {
    label: "High",
    value: 2
  },
  {
    label: "Medium",
    value: 3
  },
  {
    label: "Low",
    value: 3
  },
  {
    label: "Lowest",
    value: 3
  }
];

const CreateIssueForm = ({ onClose }: any) => {
  const handleSubmit = (data) => {
    alert(JSON.stringify(data, null, 2));
  };
  return (
    <FProvider onSubmit={handleSubmit} defaultValues={INITIAL_FORM_DATA}>
      <ConnectForm>
        {({ control, formState }: any) => {
          const { errors } = formState;
          return (
            <>
              <ModalBody px={10} py={8}>
                <VStack align="start" spacing={5}>
                  <VStack spacing={1} w="full" alignItems="Start">
                    <Input
                      inputName="reactselect"
                      customLabel={
                        <FormLabel fontSize="sm" mb={1}>
                          Issue Type
                        </FormLabel>
                      }
                      name="issueType"
                      options={ISSUE_TYPE_OPTION}
                      control={control}
                      errors={errors}
                      required
                    />
                    <Text fontSize="sm">
                      Start typing to get a list of possible matches.
                    </Text>
                  </VStack>
                  <Divider borderColor="gray.400" />
                  <VStack spacing={1} w="full" alignItems="Start">
                    <Input
                      size="sm"
                      borderColor="gray.300"
                      customLabel={
                        <FormLabel fontSize="sm" mb={1}>
                          Short Summary
                        </FormLabel>
                      }
                      name="shortSummary"
                      control={control}
                      errors={errors}
                      required
                    />
                    <Text fontSize="sm">
                      Concisely summarize the issue in one or two sentences.
                    </Text>
                  </VStack>

                  <VStack spacing={1} w="full" alignItems="Start">
                    <Input
                      inputName="texteditor"
                      customLabel={
                        <FormLabel fontSize="sm" mb={1}>
                          Description
                        </FormLabel>
                      }
                      name="description"
                      control={control}
                      errors={errors}
                      required
                    />
                    <Text fontSize="sm">
                      Describe the issue in as much detail as you'd like.
                    </Text>
                  </VStack>

                  <Input
                    inputName="reactselect"
                    customLabel={
                      <FormLabel fontSize="sm" mb={1}>
                        Reporter
                      </FormLabel>
                    }
                    name="reporter"
                    options={REPORTER_OPTION}
                    control={control}
                    errors={errors}
                    required
                  />
                  <Input
                    inputName="reactselect"
                    customLabel={
                      <FormLabel fontSize="sm" mb={1}>
                        Assignees
                      </FormLabel>
                    }
                    name="assignees"
                    options={REPORTER_OPTION}
                    control={control}
                    errors={errors}
                    required
                  />

                  <VStack spacing={1} w="full" alignItems="Start">
                    <Input
                      inputName="reactselect"
                      customLabel={
                        <FormLabel fontSize="sm" mb={1}>
                          Priority
                        </FormLabel>
                      }
                      name="priority"
                      options={PRIORITY_OPTION}
                      control={control}
                      errors={errors}
                      required
                    />
                    <Text fontSize="sm">
                      Priority in relation to other issues.
                    </Text>
                  </VStack>
                </VStack>
              </ModalBody>
              <ModalFooter>
                <HStack spacing={2}>
                  <Button
                    bg="brand.secondary"
                    _hover={{ bg: "brand.primary" }}
                    size="sm"
                    fontWeight="normal"
                    color="white"
                    type="submit"
                    borderRadius="sm"
                  >
                    Create Issue
                  </Button>
                  <Button
                    size="sm"
                    fontWeight="normal"
                    onClick={onClose}
                    borderRadius="sm"
                  >
                    Cancel
                  </Button>
                </HStack>
              </ModalFooter>
            </>
          );
        }}
      </ConnectForm>
    </FProvider>
  );
};

export default CreateIssueForm;
