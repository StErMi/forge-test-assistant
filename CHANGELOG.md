# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.0.4] - 2023-05-13

### Fixed

-   Fixed wrong path usage when forge test results had to be parsed

## [0.0.3] - 2023-05-13

### Fixed

-   `foundry.toml` is loaded from the correct workspace path
-   `src` from `foundry.toml` is used as relative path

## [0.0.2] - 2023-05-09

### Fixed

-   Fixed visual position of "Run test" UI button
-   Improved solidity imports discoverability

## [0.0.1] - 2023-05-09

### Added

-   Populate the "Test" tab of Visual Studio Code with all the forge tests organized by Test files and Test Contract
-   Run the "active" Test Contract from a command or keyboard shortcut `Ctrl+Shift+1` (win) or `Cmd+Shift+1` (mac)
-   Run the "active" Test Function from a command or keyboard shortcut `Ctrl+Shift+2` (win) or `Cmd+Shift+2` (mac)
