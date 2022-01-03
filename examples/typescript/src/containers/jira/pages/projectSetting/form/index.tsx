import { Box, Button, FormLabel, VStack } from "@chakra-ui/react";
import React from "react";
import { FProvider, ConnectForm } from "../../../../../components/formProvider";

import Input from "../../../../../components/input";

const INITIAL_FORM_DATA = {
  name: "singularity 1.0",
  url: "https://www.atlassian.com/software/jiffra",
  description:
    "Plan, track, and manage your agile and software development projects in Jira. Customize your workflow, collaborate, and release great software.",
  projectCategory: {
    label: "Software",
    value: 1
  }
};

const CATEGORY_OPTION = [
  {
    label: "Software",
    value: 1
  },
  {
    label: "Marketing",
    value: 2
  },
  {
    label: "Bussiness",
    value: 3
  }
];

const ProjectSettingForm = () => {
  const handleSubmit = (data) => {
    alert(JSON.stringify(data, null, 2));
  };
  return (
    <Box mt={5}>
      <FProvider onSubmit={handleSubmit} defaultValues={INITIAL_FORM_DATA}>
        <ConnectForm>
          {({ control, formState }: any) => {
            const { errors } = formState;
            return (
              <>
                <VStack align="start" spacing={5}>
                  <Input
                    size="sm"
                    borderColor="gray.300"
                    customLabel={
                      <FormLabel fontSize="sm" mb={1}>
                        Names
                      </FormLabel>
                    }
                    name="name"
                    control={control}
                    errors={errors}
                    required
                  />
                  <Input
                    size="sm"
                    borderColor="gray.300"
                    customLabel={
                      <FormLabel fontSize="sm" mb={1}>
                        URL
                      </FormLabel>
                    }
                    name="url"
                    control={control}
                    errors={errors}
                    required
                  />
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
                  <Input
                    inputName="reactselect"
                    customLabel={
                      <FormLabel fontSize="sm" mb={1}>
                        Project Category
                      </FormLabel>
                    }
                    name="projectCategory"
                    options={CATEGORY_OPTION}
                    control={control}
                    errors={errors}
                    required
                  />
                </VStack>
                <Button
                  mt={7}
                  bg="brand.secondary"
                  _hover={{ bg: "brand.primary" }}
                  size="sm"
                  fontWeight="normal"
                  color="white"
                  type="submit"
                  borderRadius="sm"
                >
                  Save Changes
                </Button>
              </>
            );
          }}
        </ConnectForm>
      </FProvider>
    </Box>
  );
};

export default ProjectSettingForm;
