import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./index.css"; // 用于引入 TailwindCSS

createRoot(document.getElementById("root")).render(<App />);