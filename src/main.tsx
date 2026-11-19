import { render } from "preact";
import { createSession } from "./simulation/session";
import { App } from "./ui/App";
import "./ui/style.css";

const root = document.getElementById("app");
if (!root) throw new Error("Missing app root");

let session: ReturnType<typeof createSession> | undefined;
let timer: number | undefined;
const syncVisibility = () => {
  window.clearInterval(timer);
  if (document.hidden) return;
  if (!session) {
    session = createSession(Date.now());
    render(<App simulation={session} />, root);
  } else {
    session.advance(Date.now());
  }
  const active = session;
  timer = window.setInterval(() => active.advance(Date.now()), 1000);
};
document.addEventListener("visibilitychange", syncVisibility);
syncVisibility();
if (import.meta.hot)
  import.meta.hot.dispose(() => {
    window.clearInterval(timer);
    document.removeEventListener("visibilitychange", syncVisibility);
    render(null, root);
  });
