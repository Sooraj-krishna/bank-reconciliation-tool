/**
 * @file AppContext.js
 * @description Defines the AppContext and exports the useAppContext hook.
 *   Separated from AppContext.jsx to satisfy react-refresh rules.
 */

import { createContext } from "react";

// Create the context object; components will subscribe to this.
export const AppContext = createContext();
