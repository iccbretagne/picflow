# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog, and this project adheres to Semantic Versioning.

## [Unreleased]

## [v0.2.0-rc.1] - 2026-01-29
### Breaking Changes
- Media IDs now use cuid2 only; legacy media IDs are no longer accepted by the API.
- Event photos are now stored in Media (type=PHOTO) with versioning; Photo table is no longer used for event flows.

### Added
- Media extension foundation (visuals/videos) and projects CRUD.
- Presigned URL upload system for media.
- Review workflow UI with comments and versioning.
- Project share validation/download and version upload endpoints.

### Changed
- Renamed the application and documentation from PicFlow to MediaFlow.
- Validation submit now accepts decisions for photos only (media handled by status transitions).
- Updated login experience to align with the ICC visual identity.
- Standardized input placeholder contrast for readability.

### Fixed
- Review status persistence and comment creation.
- Media thumbnail refresh after version upload.
- Clamped event photo statuses to PENDING/APPROVED/REJECTED.
- Lint/validation issues in settings, validation, and comments routes.

## [v0.1.0-beta.2] - 2026-01-24
### Added
- Release documentation and changelog.

## [v0.1.0-beta.1] - 2026-01-24
### Added
- MVP beta release tag (retag of the deployed MVP).
