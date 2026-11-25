import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import StatsScreen from "./StatsScreen.jsx";
import { DialogHost } from "./dialog.jsx";

// index.html#stats (oder #stats=<id>): Game-Stats-Screen (Pop-out-Fenster und NDI), sonst die App
const stats = /^#stats(=|&|$)/.test(window.location.hash);
ReactDOM.createRoot(document.getElementById("root")).render(stats ? <StatsScreen /> : <><App /><DialogHost /></>);
