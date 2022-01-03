import * as React from "react";
import { Controller } from "react-hook-form";
import { Text } from "@chakra-ui/layout";

// COMPONENTS
import TextInput from "./textInput";
import { TextArea } from "./textArea";
import TextEditor from "./textEditor";
import ReactSelect from "./reactSelect";
import Checkboxgroup from "./checkboxGroup";
import TextPassword from "./textPassword";
import RadioGroup from "./radioGroup";

// CHAKRA-UI
import { FormControl, FormLabel } from "@chakra-ui/form-control";

// UTILITIES
import { regex, resolveObjectValueByPath } from "../../helpers";
import ReactDatePicker from "./reactDatepicker";

const getInputComponent = (inputName: string) => {
  let components: any = {
    textinput: TextInput,
    textpassword: TextPassword,
    reactselect: ReactSelect,
    textarea: TextArea,
    texteditor: TextEditor,
    checkboxgroup: Checkboxgroup,
    reactdatepicker: ReactDatePicker,
    radiogroup: RadioGroup
  };

  return inputName ? components[inputName] : components["textinput"];
};

function Input(props: any) {
  const {
    customLabel,
    name,
    label,
    type,
    width,
    control,
    ignoreControl = false,
    required = false,
    errors
  } = props;

  const error = errors && resolveObjectValueByPath(errors, name)?.message;

  let InputComponent = getInputComponent(props.inputName);

  return (
    <FormControl id={name} isRequired={required} style={{ width }}>
      {customLabel ? customLabel : <FormLabel>{label}</FormLabel>}
      {InputComponent && (
        <>
          {!control || ignoreControl ? (
            <InputComponent {...props} />
          ) : (
            <Controller
              control={control}
              name={name}
              rules={{
                required: {
                  value: required,
                  message: "required"
                },
                pattern: {
                  value: type === "email" && regex.email ? "" : required,
                  message: "invalid e-mail"
                },
                minLength: {
                  value: 2,
                  message: "This input is below minLength."
                }
              }}
              render={(controllerProps) => {
                const {
                  field: { onChange, value }
                } = controllerProps;

                return (
                  <InputComponent
                    {...props}
                    value={value}
                    onChangeRHF={onChange}
                  />
                );
              }}
            />
          )}
        </>
      )}
      {/* RENDER ERROR */}
      {error && <Text color="red.500">{error}</Text>}
    </FormControl>
  );
}

export default Input;
