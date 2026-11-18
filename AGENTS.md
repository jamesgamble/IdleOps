# IdleOps developer instructions

Read the linked Issue, [product scope](docs/product.md), and [contribution guide](CONTRIBUTING.md) before changing files. GitHub is the source of approved scope and decisions.

- Implement one approved assignment per branch. Include the Issue number in the pull request.
- Keep all application logic client-side and static-host compatible. Generate fictional events locally. Never connect the dashboard to real infrastructure or add credentials, telemetry, authentication, or operational controls.
- Use a shared simulation state for related views. Limit timers, animation work, and retained history. Restrict browser storage to harmless settings.
- Keep dependencies minimal. Explain material changes in architecture to the Product Owner before implementing them.
- Run relevant checks and exercise changed behavior. Report exact commands, results, outstanding failures, and untested paths. For visual changes include browser, viewport, and screenshots where practical.
- Avoid public deployment, purchases, destructive changes, and changes to sensitive access without explicit Product Owner approval.
