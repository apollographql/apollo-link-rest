import React from "react";
import Select from "react-select";

const ReactSelect = (props: any) => {
  let { name, value } = props;
  const handleChange = (value: any) => {
    props.onChange2 && props.onChange2(name, value);
    props.onChangeRHF && props.onChangeRHF(value);
  };

  return (
    <Select onChange={handleChange} value={value} options={props.options} />
  );
};

export default ReactSelect;
