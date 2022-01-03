import { useFormContext } from "react-hook-form";

export const ConnectForm = ({ children }: any) => {
  const methods = useFormContext();

  return children({ ...methods });
};
