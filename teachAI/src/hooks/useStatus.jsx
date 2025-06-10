import { createContext, useContext, useState } from "react";

const StatusCtx = createContext();
export const StatusProvider = ({ children }) => {
  const [status, setStatus] = useState({ message: "", type: "" });
  const showStatus = (message, type = "success") => {
    setStatus({ message, type });
    setTimeout(() => setStatus({ message: "", type: "" }), 4000);
  };
  return (
    <StatusCtx.Provider value={{ status, showStatus }}>{children}</StatusCtx.Provider>
  );
};
export default () => useContext(StatusCtx);
