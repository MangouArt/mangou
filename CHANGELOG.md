# Changelog

## [Unreleased] - 2026-04-02

### Added
- **Storyboard Engine**: Implemented strict sequence management to enforce master grid ordering before child shots, preventing rendering glitches.
- **AIGC Pipeline**: Integrated `KIE AI` provider supporting high-quality image generation, context-aware editing, and binary file uploads.
- **Model Support**: Added explicit support for `nano-banana-2` vision models in task configurations.
- **Hierarchical Sync**: Automated synchronization between master grids and individual sub-shots with intelligent property inheritance.
- **Vercel Analytics**: Integrated telemetry to track web-ui performance and user interaction patterns.

### Changed
- **Architecture Refactor**: Transitioned to a Metadata-driven (Single Source of Truth) model, consolidating asset and storyboard management into unified YAML/JSON schemas.
- **Commercialization**: Decoupled billing and authentication from the core plugin into a modular FastAPI-based backend service deployed on Sealos K8s.
- **CI/CD Modularization**: Refactored `.cnb.yml` configuration to enable independent pipelines for the Core Skill, Frontend Site, and Billing Backend.
- **Provider Logic**: Enhanced provider priority resolution and added "Happy Path" validation with explicit error feedback for missing parameters.
- **Headless Stability**: Decoupled core scripts from local web dependencies and implemented robust file-system locking for `tasks.jsonl`.

### Fixed
- **VFS Resolution**: Resolved pathing issues for assets stored in deep workspace hierarchies and improved workspace-relative resolution.
- **KIE Integration**: Refactored file uploads from Base64 to multipart/form-data for 10x faster asset synchronization.
- **UI/UX**: Fixed vertical scrolling issues on mobile devices for the Mangou landing page.

## [1.0.0] - 2026-04-01

- **Core Launch**: Initial open-source release of the Mangou AI Director core engine.
- **Infrastructure**: Added release metadata, CI workflows, and repository governance files.
- **Documentation**: Reworked README into localized (EN/CN) versions focusing on local-first skill distribution.
- **Testing**: Established initial vitest suite for core AIGC provider logic and skill packaging.
