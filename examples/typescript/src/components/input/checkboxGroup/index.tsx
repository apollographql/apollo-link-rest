import React, { useEffect, useState } from "react";
import { HStack, Checkbox } from "@chakra-ui/react";

const Checkboxgroup = (props: any) => {
  const [checkedValues, setCheckedValues] = useState<any>([]);

  useEffect(() => {
    if (props.value) {
      setCheckedValues(props.value);
    }
  }, [props.value]);

  function handleSelect(checkedValue) {
    let containsInChecked: boolean = checkedValues?.some(
      (value: any) => value.value === checkedValue.value
    );
    console.log("containsInChecked", containsInChecked);

    let removedFromCheckedValues = checkedValues?.filter(
      (value) => value.value !== checkedValue.value
    );
    console.log("removedFromCheckedValues", removedFromCheckedValues);

    let addToCheckedValues = [...(checkedValues ?? []), checkedValue];
    console.log("addToCheckedValues", addToCheckedValues);

    const newValues = containsInChecked
      ? removedFromCheckedValues
      : addToCheckedValues;

    console.log("newValues", newValues);
    setCheckedValues(newValues);

    return newValues;
  }

  return (
    <HStack>
      <>
        {props.options ? (
          props.options.map((item: any, idx: number) => {
            let foundInCheckedValues = checkedValues.find((cv) => {
              return cv.value === item.value;
            });

            return (
              <Checkbox
                {...props}
                key={`${idx}`}
                isChecked={foundInCheckedValues ? true : false}
                onChange={() => props.onChangeRHF(handleSelect(item))}
              >
                {item.label}
              </Checkbox>
            );
          })
        ) : (
          <>No data</>
        )}
      </>
      <pre>{JSON.stringify(checkedValues)}</pre>
    </HStack>
  );
};

export default Checkboxgroup;
