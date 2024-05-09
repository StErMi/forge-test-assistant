<p align="center">
  <br />
  <img src="https://book.getfoundry.sh/images/foundry-banner.png" width="400" alt="">
  <br />
  <h2 align="center">Forge Test Assistant</h2>
  <p align="center"><strong>This visual studio extension will allow you to quickly run Foundry tests and assists you during the process!</strong></p>
</p>

-   🚧 Note 1: the Visual Studio Extension is still in alpha.
-   🚧 Note 2: The current chosen keyboard shortcut are subject to change before the official release. Users can anyway change them inside their personal settings.

## Features

-   Populate the "Test" tab of Visual Studio Code with all the forge tests organized by Test files and Test Contract
-   Run the "active" Test Contract from a command or keyboard shortcut `Ctrl+Shift+1` (win) or `Cmd+Shift+1` (mac)
-   Run the "active" Test Function from a command or keyboard shortcut `Ctrl+Shift+2` (win) or `Cmd+Shift+2` (mac)

ℹ️ `active` means the contract/function where you active cursor is focussed at

## TODO

-   [ ] Choose the best keyboard shortcuts to run contract/function tests
-   [ ] Improve test discovery performance
-   [ ] Improve test failure error parsing
-   [ ] Improve forge command output parsing (if possible) when runned from the Test Suite

## Requirements

This extensions will only work on Solidity projects that are based on the Foundry development toolchain.

## Extension Settings

-   Personalize keyboard shortcuts: Open Keyboard Shortcuts -> Forge Test Assistant -> shortcut to run tests matching Contract or Function name
-   Personalize default test Verbosity level: Open User Settings -> Forge Test Assistant -> Verbosity

## Disclosures, Acknowledgement, Tools and Libs

-   [Foundry & Forge](https://github.com/foundry-rs/foundry)
-   [solidity-workspace](https://github.com/tintinweb/solidity-workspace)

## Social

-   Website: [https://stermi.xyz](https://stermi.xyz/)
-   Twitter: [@StErMi](https://twitter.com/StErMi)
