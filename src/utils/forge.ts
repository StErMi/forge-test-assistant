import * as vscode from 'vscode';
import { execSync } from 'child_process';
import { ForgeTestResult } from '../features/models';

export const loadForgeConfigSync = (workspaceRootPath: string) => {
    const rawContent = execSync('forge config --json', { stdio: 'pipe', cwd: workspaceRootPath }).toString();
    const config = JSON.parse(rawContent);

    // by default the src folder is 'src'
    // by default the test folder is 'test'
    return {
        src: config.src ? config.src : 'src',
        test: config.test ? config.test : 'test',
    };
};

export const parseTestResult = (
    testFilePath: string,
    contractName: string,
    isFuzz: boolean,
    functionSignature: string,
    expectFail: boolean,
    forgeJSON: string
): ForgeTestResult => {
    const result = JSON.parse(forgeJSON);
    const testResult = result[`${testFilePath}:${contractName}`].test_results;
    const functionResult = testResult[functionSignature];

    // functionResult.status = Success | Failure | ???
    const success = functionResult.status === 'Success';
    const errors: string[] = functionResult.decoded_logs;

    // it seems that if a failure is expected, forge does not include the error
    if (!success && expectFail && errors.length === 0) {
        errors.push('Expected failure but all assertions succeeded');
    }

    let gas = 0;
    if (!isFuzz) {
        gas = functionResult.kind.Standard;
    } else {
        // TODO: is this one the right one to pick?
        gas = functionResult.kind.Fuzz.median_gas;
    }

    return {
        success: functionResult.status === 'Success',
        gas: gas,
        duration: {
            secs: functionResult.duration.secs,
            nanos: functionResult.duration.nanos,
        },
        errors: functionResult.decoded_logs,
    };
};

export const runTestInTerminal = (command: string) => {
    let activeTerminal = vscode.window.activeTerminal;
    if (!activeTerminal) {
        // take the very first if they have any, otherwise create a new one
        if (vscode.window.terminals.length > 0) {
            activeTerminal = vscode.window.terminals[0];
        } else {
            activeTerminal = vscode.window.createTerminal(`Forge Test`);
        }
    }

    // show the terminal, preserve the focus to run additional keyboard shortcuts
    activeTerminal.show(true);

    // run the command in the selected terminal
    activeTerminal.sendText(command);
};
