# Contributing

Discuss product ideas before implementation. A feature request starts a discussion. The Product Owner approves major direction and Work records approved behavior, priority, dependencies, and acceptance criteria in an Issue.

## From Issue to pull request

1. Choose a ready Issue. Work gives Codex the objective, context, constraints, expected tests, and deliverables.
2. Branch from the latest `main` using a short descriptive name. Keep the change focused and update the documentation that describes affected behavior.
3. Run appropriate checks. CI checks required files, local Markdown links, and YAML syntax. For application changes, run the [shell checks](README.md#verify-the-shell) and include browser and viewport evidence in the PR.
4. Open a pull request with `Closes #<issue>`. Record changes, verification, failures, and limitations. Resolve failing checks and review feedback.
5. Work reviews the diff and verifies each acceptance criterion. For user-facing changes, check simulation consistency, browser behavior, layout, and performance. Merge once applicable checks and review are complete.

## Release

Use a milestone to group approved release work. Once a release is verified, record a semantic version tag and short GitHub Release notes identifying changes and known limitations. The first public deployment requires Product Owner approval and a verified static-hosting method. Verify the live app after deployment and retain a known-good release for recovery.
