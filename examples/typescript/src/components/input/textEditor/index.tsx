import React from "react";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";

const TextEditor = (props) => {
  let { name, value, onChangeRHF, onChange2 } = props;
  const handleChange = (value: any) => {
    onChange2 && onChange2(name, value);
    onChangeRHF && onChangeRHF(value);
  };

  return (
    <ReactQuill theme="snow" value={value || ""} onChange={handleChange} />
  );
};

export default TextEditor;
