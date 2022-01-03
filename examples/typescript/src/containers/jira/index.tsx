import React, { useEffect, useState } from "react";
import { Spinner, Flex, useDisclosure } from "@chakra-ui/react";
import Sidebar from "./sidebar";
import Navigator from "./navigator";
// import Spinner from "./spinner";
import { Routes, Route, Link, Outlet } from "react-router-dom";

// COMPONENTS
import PageLoading from "./pageLoading";
import CreateIssueModal from "./createIssueModal";
const ProjectBoard = React.lazy(() => import("./pages/projectBoard"));
const ProjectSetting = React.lazy(() => import("./pages/projectSetting"));

const JiraApp = () => {
  const [loader, setLoader] = useState(true);
  const { isOpen, onOpen, onClose } = useDisclosure();

  useEffect(() => {
    setTimeout(() => {
      setLoader(false);
    }, 100);
  }, []);

  if (loader) {
    return <PageLoading />;
  }

  const handleOpenCreateIssueModal = () => onOpen();

  return (
    <>
      <Flex>
        <Sidebar handleOpenCreateIssueModal={handleOpenCreateIssueModal} />
        <Routes>
          <Route
            path="/"
            element={
              <>
                <Navigator />
                <Outlet />
              </>
            }
          >
            <Route
              path="board"
              element={
                <React.Suspense fallback={<PageLoading />}>
                  <ProjectBoard />
                </React.Suspense>
              }
            />
            <Route
              path="settings"
              element={
                <React.Suspense fallback={<PageLoading />}>
                  <ProjectSetting />
                </React.Suspense>
              }
            />
          </Route>
        </Routes>
      </Flex>
      <CreateIssueModal isOpen={isOpen} onClose={onClose} />
    </>
  );
};

export default JiraApp;
