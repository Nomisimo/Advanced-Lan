import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import StatsScreen from "./StatsScreen.jsx";

// index.html#stats: Game-Stats-Screen (Pop-out-Fenster und NDI), sonst die App
const stats = window.location.hash === "#stats";
ReactDOM.createRoot(document.getElementById("root")).render(stats ? <StatsScreen /> : <App />);
