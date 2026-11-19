import { useEffect, useRef, useState } from "preact/hooks";
import axiom from "../assets/axiom.svg";
import { Workspace } from "../screens/Workspace";
import type { Simulation } from "../simulation/session";
import { Icon } from "./Icon";
import { href, operations, type Route, readRoute, screens } from "./routes";

export function App({ simulation }: { simulation: Simulation }) {
  const [route, setRoute] = useState(() => readRoute(location.hash));
  const [collapsed, setCollapsed] = useState(false);
  const main = useRef<HTMLElement>(null);
  useEffect(() => {
    const navigate = () => {
      setRoute(readRoute(location.hash));
      main.current?.focus();
      main.current?.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", navigate);
    return () => window.removeEventListener("hashchange", navigate);
  }, []);
  useEffect(() => {
    document.title = `${screens[route].name} · IdleOps`;
  }, [route]);
  const navLink = (item: Route) => (
    <a
      class="nav-link"
      key={item}
      href={href(item)}
      aria-label={screens[item].name}
      title={collapsed ? screens[item].name : undefined}
      aria-current={route === item ? "page" : undefined}
    >
      <Icon name={item} />
      <span class="nav-text">{screens[item].name}</span>
    </a>
  );

  return (
    <div class={`shell${collapsed ? " collapsed" : ""}`}>
      <button type="button" class="skip" onClick={() => main.current?.focus()}>
        Skip to workspace
      </button>
      <header class="topbar">
        <div class="corporate">
          <img src={axiom} alt="" />
          <strong>
            AXIOM <span class="industry-name">INDUSTRIES</span>
          </strong>
        </div>
        <span class="division">Global Technology Operations</span>
        <div class="simulation-status">
          <i />
          Simulation active
        </div>
        <a
          class="header-settings"
          href={href("settings")}
          aria-label="Open settings"
        >
          <Icon name="settings" />
        </a>
      </header>
      <aside class="sidebar">
        <div class="app-brand">
          <div class="app-mark">
            <Icon name="pulse" size={23} />
          </div>
          <b class="nav-text">
            Idle<span>Ops</span>
          </b>
        </div>
        <nav aria-label="Sidebar" id="navigation">
          <div class="nav-label">
            <span class="nav-text">Operations</span>
          </div>
          {operations.map(navLink)}
          <div class="nav-label system">
            <span class="nav-text">System</span>
          </div>
          {navLink("settings")}
        </nav>
        <button
          class="collapse"
          type="button"
          aria-expanded={!collapsed}
          aria-controls="navigation"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand sidebar" : undefined}
          onClick={() => setCollapsed((value) => !value)}
        >
          <Icon name="panel" />
          <span class="nav-text">Collapse sidebar</span>
        </button>
      </aside>
      <main id="workspace" tabIndex={-1} ref={main}>
        <div class="content" key={route}>
          <Workspace route={route} simulation={simulation} />
        </div>
        <footer>
          <span class="footer-brand">IdleOps</span>
          <span>Local simulation workspace</span>
        </footer>
      </main>
    </div>
  );
}
