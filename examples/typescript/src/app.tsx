import React from "react";
import { Box } from "@chakra-ui/react";
import RoleForm from "./containers/form";
import JiraApp from "./containers/jira";
import COAForm from "./containers/form/chartOfaccountForm";
import { PzProvider } from "./designSystem";
import { extendTheme } from "@chakra-ui/react";
import { BrowserRouter } from "react-router-dom";

const theme = extendTheme({
  colors: {
    brand: {
      primary: "#0747A6",
      secondary: "#005EEB"
    }
  }
});

const App = () => {
  return (
    <BrowserRouter>
      <PzProvider theme={theme}>
        {/* <Box padding={5}>
          <RoleForm />
        </Box> */}
        <Box padding={5}>
          <COAForm />
        </Box>
        {/* <JiraApp /> */}
      </PzProvider>
    </BrowserRouter>
  );
};
export default App;
