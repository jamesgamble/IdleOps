# Product and architecture

IdleOps simulates the operations dashboard a systems engineer might keep open. Its value comes from believable relationships between fictional events. A simulated service incident, for example, could affect that service's status, metrics, and log entries together.

The application must be deliverable as static files and operate entirely in a modern desktop browser. UI controls may change simulated state. A lightweight shared simulation layer supplies the views. Storage is limited to harmless preferences. Layouts should adapt to available space and simulated activity must keep CPU and memory use modest.

## Decisions

- GitHub Issues record approved product behavior and milestones organize release work.
- Framework, build tooling, first-release feature scope, and visual design await approved implementation requirements.
- Hostinger is provisional. Verify a static deployment and recovery method before connecting production hosting.
