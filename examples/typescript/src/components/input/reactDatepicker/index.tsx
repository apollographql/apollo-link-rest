import React, { forwardRef, useState } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { Button } from "@chakra-ui/react";
// interface ReactDatePickerProps extends TextareaProps {
// }

const ExampleCustomInput = forwardRef(({ value, onClick }: any, ref) => (
  <Button className="example-custom-input" onClick={onClick} ref={ref}>
    {value}
  </Button>
));

const ReactDatePicker: React.FunctionComponent<any> = (props) => {
  const { name, value } = props;

  const [startDate, setStartDate] = useState(new Date());

  const handleChange = (date: any) => {
    props?.onChange2(name, value);
    props?.onChangeRHF(date);
    setStartDate(date);
  };

  return (
    <DatePicker
      selected={startDate}
      onChange={(date) => handleChange(date)}
      customInput={<ExampleCustomInput />}
    />
  );
};

export default ReactDatePicker;
