import { useForm, FormProvider } from "react-hook-form";
import React from "react";
interface FormProviderProps {
  defaultValues?: any;
  children?: any;
  onSubmit?: any;
}

export const FProvider = ({
  defaultValues,
  children,
  onSubmit
}: FormProviderProps) => {
  const methods = useForm({ defaultValues: defaultValues });

  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit(onSubmit)}>{children}</form>
    </FormProvider>
  );
};
