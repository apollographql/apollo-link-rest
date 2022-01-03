import { Box, Text, Button, VStack } from "@chakra-ui/react";
import React, { useEffect, useState } from "react";
import { FProvider, ConnectForm } from "../../components/formProvider";

import Input from "../../components/input";

const INITIAL_FORM_DATA = {
  name: "pujan",
  code: "sakya",
  description: "test description",
  accoutType: { value: "1", label: "Assets" },
  detailType: { value: "vanilla", label: "Vanilla" },
  groupUnder: { value: "chocolate", label: "Chocolate" },
  bankAccount: "sakya",
  defaultAssignUnit: { value: "chocolate", label: "Chocolate" },
  linkToList: { value: "chocolate", label: "Chocolate" },
  associatedTax: { value: "chocolate", label: "Chocolate" }
};

const getUsers = () => Promise.resolve(INITIAL_FORM_DATA);

const COAFormComponent = ({ control, errors, watch, reset, getValues }) => {
  const detailTypeDefault = getValues("detailType");
  const detailTypeWatcher = watch("detailType");

  useEffect(() => {
    const subscription =
      watch &&
      watch((value, { name, type }) => {
        if (name === "accoutType") {
          reset({
            ...value,
            detailType: {},
            groupUnder: {}
          });
        }
        if (name === "detailType") {
          reset({
            ...value,
            groupUnder: {}
          });
        }
      });
    return () => subscription.unsubscribe();
  }, [watch]);

  return (
    <VStack align="start">
      <Input
        label="Name"
        name="name"
        control={control}
        errors={errors}
        required
      />
      <Input
        label="Code"
        name="code"
        control={control}
        errors={errors}
        required
      />
      <Input
        inputName="textarea"
        label="Description"
        name="description"
        control={control}
        required
      />
      <Input
        inputName="radiogroup"
        label="Account Type"
        name="accoutType"
        control={control}
        options={[
          { value: "1", label: "Assets" },
          { value: "2", label: "Liabilities" },
          { value: "3", label: "Equity" },
          { value: "4", label: "Incomes" },
          { value: "5", label: "Expenses" }
        ]}
        errors={errors}
        required
      />

      <Input
        inputName="reactselect"
        label="Detail Type"
        name="detailType"
        options={[
          { value: "chocolate", label: "Chocolate" },
          { value: "strawberry", label: "Strawberry" },
          { value: "vanilla", label: "Vanilla" }
        ]}
        control={control}
        errors={errors}
        required
      />

      {(detailTypeDefault === "vanilla" ||
        detailTypeWatcher?.value === "vanilla") && (
        <Input
          inputName="reactselect"
          label="Current/Saving"
          name="savingAccount"
          options={[
            { value: "current", label: "Current" },
            { value: "saving", label: "Saving" }
          ]}
          control={control}
          errors={errors}
          required
        />
      )}

      <Input
        inputName="reactselect"
        label="Group under"
        name="groupUnder"
        options={[
          { value: "chocolate", label: "Chocolate" },
          { value: "strawberry", label: "Strawberry" },
          { value: "vanilla", label: "Vanilla" }
        ]}
        control={control}
        errors={errors}
        required
      />

      <Input
        label="Bank Account"
        name="bankAccount"
        control={control}
        errors={errors}
        required
      />

      <Input
        inputName="reactselect"
        label="Default Assing Unit"
        name="defaultAssignUnit"
        options={[
          { value: "chocolate", label: "Chocolate" },
          { value: "strawberry", label: "Strawberry" },
          { value: "vanilla", label: "Vanilla" }
        ]}
        control={control}
        errors={errors}
        required
      />

      <Input
        inputName="reactselect"
        label="Link to list"
        name="linkToList"
        options={[
          { value: "chocolate", label: "Chocolate" },
          { value: "strawberry", label: "Strawberry" },
          { value: "vanilla", label: "Vanilla" }
        ]}
        control={control}
        errors={errors}
        required
      />

      <Input
        inputName="reactselect"
        label="Associated Tax"
        name="associatedTax"
        options={[
          { value: "chocolate", label: "Chocolate" },
          { value: "strawberry", label: "Strawberry" },
          { value: "vanilla", label: "Vanilla" }
        ]}
        control={control}
        errors={errors}
        required
      />

      <Button type="submit">Submit</Button>
    </VStack>
  );
};

const COAForm = () => {
  const handleSubmit = (data) => {
    console.log(JSON.stringify(data, null, 2));
  };

  const [loading, setLoading] = useState(false);
  const [defaultValues, setDefaultValues] = useState<any>();

  useEffect(() => {
    setLoading(true);
    setTimeout(() => {
      getUsers().then((result) => {
        setDefaultValues((prev) => ({
          ...prev,
          ...result
        }));
        setLoading(false);
      });
    }, 2000);
  }, []);

  if (loading) {
    return (
      <Box bg="red.200">
        <Text>Loading</Text>
      </Box>
    );
  }
  return (
    <FProvider onSubmit={handleSubmit} defaultValues={defaultValues}>
      <ConnectForm>
        {({ control, formState, reset, watch, getValues }: any) => {
          const { errors } = formState;
          return (
            <COAFormComponent
              errors={errors}
              watch={watch}
              control={control}
              reset={reset}
              getValues={getValues}
            />
          );
        }}
      </ConnectForm>
    </FProvider>
  );
};

export default COAForm;
