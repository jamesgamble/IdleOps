# Product and architecture

[Product Design & Requirements Handoff v1.0](design-handoff-v1.md) is the approved specification. Its 18 sections and AC-01 through AC-20 govern the first release. [Development roadmap](roadmap.md) maps delivery, verification and open decisions. Resolve discrepancies with the Product Owner before changing either scope or behavior.

IdleOps is an entirely local, silent simulation of Axiom Industries' operations. Visual impact, believable behavior and interactive investigation have equal weight. A single fictional environment powers Command Center, Infrastructure, Networking, Security, Event Console and Settings. The persistent simulation indicator, startup and About identify IdleOps explicitly.

Model 30–50 detailed resources across five sites and two fictional clouds. Enterprise totals separately represent a larger estate. Incidents, alerts, weighted health, topology, actions, terminal output and the last 500 log entries describe the same conditions. Fixed 24-hour charts start populated; resolved incident timelines survive log eviction. Only harmless preferences survive a reload.

The app ships as static assets, with no real operational controls, runtime services, credentials or external telemetry. Desktop and ultrawide screens are the release targets. Build incrementally; all screens and the baseline interactions specified in the handoff are in the first release. Hostinger remains provisional and public deployment requires explicit approval.
