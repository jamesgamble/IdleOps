import { render } from "preact";
import { createSession } from "./simulation/session";
import { App } from "./ui/App";
import "./ui/style.css";

const root = document.getElementById("app");
if (!root) throw new Error("Missing app root");
const session = createSession(Date.now());
const timer = window.setInterval(() => session.advance(Date.now()), 1000);
render(<App simulation={session} />, root);
if (import.meta.hot)
  import.meta.hot.dispose(() => {
    window.clearInterval(timer);
    render(null, root);
  });
