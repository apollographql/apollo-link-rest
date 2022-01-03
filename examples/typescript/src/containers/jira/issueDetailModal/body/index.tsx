import React from "react";
import {
  Flex,
  Box,
  Editable,
  EditableInput,
  EditablePreview,
  FormLabel,
  Button,
  HStack,
  Divider
} from "@chakra-ui/react";
import Input from "../../../../components/input";
const DetailBody = () => {
  return (
    <HStack sapcing={4} alignItems="start">
      <Box flex={1}>
        <Editable defaultValue="Take some chakra">
          <EditablePreview />
          <EditableInput />
        </Editable>
        <Input
          inputName="texteditor"
          customLabel={
            <FormLabel fontSize="sm" mb={1}>
              Description
            </FormLabel>
          }
          name="description"
          ignoreControl={true}
        />
        <HStack spacing={2} mt={8}>
          <Button
            bg="brand.secondary"
            _hover={{ bg: "brand.primary" }}
            size="sm"
            fontWeight="normal"
            color="white"
            type="submit"
            borderRadius="sm"
          >
            Save
          </Button>
          <Button
            size="sm"
            fontWeight="normal"
            onClick={() => {}}
            borderRadius="sm"
          >
            Cancel
          </Button>
        </HStack>
      </Box>
      <Box flex={1}>
        <Input
          inputName="reactselect"
          label="STATUS"
          name="reactSelect"
          options={[
            { value: "chocolate", label: "Chocolate" },
            { value: "strawberry", label: "Strawberry" },
            { value: "vanilla", label: "Vanilla" }
          ]}
          ignoreControl={true}
        />
        <Input
          inputName="reactselect"
          label="ASSIGNEES"
          name="reactSelect"
          options={[
            { value: "chocolate", label: "Chocolate" },
            { value: "strawberry", label: "Strawberry" },
            { value: "vanilla", label: "Vanilla" }
          ]}
          ignoreControl={true}
        />
        <Input
          inputName="reactselect"
          label="REPORTER"
          name="reactSelect"
          options={[
            { value: "chocolate", label: "Chocolate" },
            { value: "strawberry", label: "Strawberry" },
            { value: "vanilla", label: "Vanilla" }
          ]}
          ignoreControl={true}
        />
        <Input
          inputName="reactselect"
          label="PRIORITY"
          name="reactSelect"
          options={[
            { value: "chocolate", label: "Chocolate" },
            { value: "strawberry", label: "Strawberry" },
            { value: "vanilla", label: "Vanilla" }
          ]}
          ignoreControl={true}
        />
        <Input label="ORIGINAL ESTIMATE (HOURS)" name="" ignoreControl={true} />
        <Input label="TIME TRACKING" name="" ignoreControl={true} />
        <Divider borderColor="gray.400" mt={5} />
      </Box>
    </HStack>
  );
};
export default DetailBody;
