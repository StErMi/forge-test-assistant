// IMPORTS
import * as vscode from 'vscode';
import { TestManager } from './features/test-manager/test-manager';
import { ExtensionConfig, ErrorType } from './features/models';
import { loadForgeConfigSync } from './utils/forge';
import { Commands } from './features/commands';
const mod_parser = require('solidity-workspace');

// GLOBAL VARIABLES
let config: ExtensionConfig;

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {
    // initialize the extension configuration
    // NOTE: for the moment we just support single workspace
    if (vscode.workspace.workspaceFolders === undefined || vscode.workspace.workspaceFolders.length !== 1) {
        // multi workspace not supported at the moment
        vscode.window.showWarningMessage(ErrorType.MULTIWORKSPACE_NOT_SUPPORTED);
        return;
    }

    // fetch basic data needed later on
    const workspaceRootPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
    // load Forge config from the TOML file
    const forgeConfig = loadForgeConfigSync(workspaceRootPath);
    // workspace path + root src
    const workspaceRootSolidityPath = workspaceRootPath + '/' + forgeConfig.src;
    // initialize the solidity workspace module
    const solidityWorkspace = new mod_parser.Workspace([
        `${workspaceRootPath}/`,
        `${workspaceRootSolidityPath}/${forgeConfig.test}`,
    ]);
    config = {
        workspacePath: workspaceRootSolidityPath,
        forgeConfig: forgeConfig,
        testFolderPath: forgeConfig.test,
        solidityWorkspace,
    };

    // initialize the command manager
    const commands = new Commands(config);
    await commands.initialize(context);

    // initialize the test manager
    const testManager = new TestManager(config);
    await testManager.initialize(context);
}

// This method is called when your extension is deactivated
export function deactivate() {}
