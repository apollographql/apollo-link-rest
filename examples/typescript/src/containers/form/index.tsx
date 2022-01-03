import { Box, Button, VStack } from "@chakra-ui/react";
import React, { useEffect, useState } from "react";
import { FProvider, ConnectForm } from "../../components/formProvider";

import Input from "../../components/input";

const INITIAL_VALUE = [
  {
    label: "Puzan",
    value: 1
  },
  {
    label: "John",
    value: 2
  }
];

const INITIAL_FORM_DATA = {
  firstName: "paras",
  lastName: "sakya",
  testCheckboxesGroup: [
    {
      label: "John",
      value: 2
    }
  ],
  textEditor: "asdasd",
  password: "This is password",
  textArea: "This is text area",
  today: "12/26/2021",
  reactSelect: { value: "chocolate", label: "Chocolate" }
};

const RoleFormComponent = ({ control, errors, watch, reset, getValues }) => {
  const firstNameWatcher = watch("firstName");

  // useEffect(() => {
  //   const subscription =
  //     watch &&
  //     watch((value, { name, type }) => {
  //       if (name === "firstName") {
  //         console.log(value);

  //         if (value.firstName === "paras") {
  //           reset({
  //             ...value,
  //             reactSelect: {}
  //           });
  //         }
  //       }
  //     });
  //   return () => subscription.unsubscribe();
  // }, [watch]);

  const firstNameDefault = getValues("firstName");

  return (
    <VStack align="start">
      <Input
        label="First Name"
        name="firstName"
        control={control}
        errors={errors}
        required
      />
      <Input
        label="Last Name"
        name="lastName"
        control={control}
        errors={errors}
        required
      />
      <Input
        inputName="checkboxgroup"
        label="Name Checkboxes"
        name="testCheckboxesGroup"
        control={control}
        options={INITIAL_VALUE}
        required
      />
      <Input
        inputName="texteditor"
        label="Long Text"
        name="textEditor"
        control={control}
        errors={errors}
        required
      />
      {(firstNameDefault === "paras" || firstNameWatcher === "paras") && (
        <Input
          inputName="reactselect"
          label="React Select"
          name="reactSelect"
          options={[
            { value: "chocolate", label: "Chocolate" },
            { value: "strawberry", label: "Strawberry" },
            { value: "vanilla", label: "Vanilla" }
          ]}
          control={control}
          errors={errors}
          required
        />
      )}
      {/* <Input
        inputName="reactselect"
        label="React Select"
        name="reactSelect"
        options={[
          { value: "chocolate", label: "Chocolate" },
          { value: "strawberry", label: "Strawberry" },
          { value: "vanilla", label: "Vanilla" }
        ]}
        control={control}
        errors={errors}
        required
      /> */}

      <Input
        inputName="textpassword"
        label="Password"
        name="password"
        control={control}
        errors={errors}
        required
      />
      <Input
        inputName="textarea"
        label="Text Area"
        name="textArea"
        control={control}
        errors={errors}
        required
      />
      <Input
        inputName="reactdatepicker"
        label="Date Picker"
        name="today"
        control={control}
        errors={errors}
        required
      />
      <Button type="submit">Submit</Button>
    </VStack>
  );
};

const RoleForm = () => {
  const handleSubmit = (data) => {
    alert(JSON.stringify(data, null, 2));
  };

  return (
    <FProvider onSubmit={handleSubmit} defaultValues={INITIAL_FORM_DATA}>
      <ConnectForm>
        {({ control, formState, reset, watch, getValues }: any) => {
          const { errors } = formState;
          return (
            <RoleFormComponent
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

export default RoleForm;
