import * as vscode from 'vscode';
import { ErrorType, ExtensionConfig, MatchType } from './models';
import { printError } from '../utils/error';
import { TestCase, TestContract } from './test-manager/test-tree';
import { loadSoliditySourceUnit, parseSoliditySourceUnit } from '../utils/solidity';

export class Commands {
    constructor(private readonly config: ExtensionConfig) {}

    async initialize(context: vscode.ExtensionContext) {
        const runForgeTestMatchingContractNameSubscription = vscode.commands.registerCommand(
            'forge-test-assistant.runForgeTestMatchingContractName',
            async () => {
                await this.runTest(MatchType.MatchContract);
            }
        );

        const runForgeTestMatchingFunctionNameSubscription = vscode.commands.registerCommand(
            'forge-test-assistant.runForgeTestMatchingFunctionName',
            async () => {
                await this.runTest(MatchType.MatchTest);
            }
        );

        // register the simple-commands to the subscription
        context.subscriptions.push(runForgeTestMatchingContractNameSubscription);
        context.subscriptions.push(runForgeTestMatchingFunctionNameSubscription);
    }

    // this function must look at the opened file, look at where the cursor is and execute all the tests that are inside such contract
    async runTest(matchType: MatchType) {
        const activeEditor = vscode.window.activeTextEditor;
        if (!activeEditor) {
            printError({ type: ErrorType.NO_FILE_OPEN, warning: true });
            return;
        }

        const activeDocument = activeEditor.document;

        if (
            activeDocument.uri.scheme !== 'file' ||
            !activeDocument.uri.path.endsWith('.sol') ||
            !activeDocument.uri.path.startsWith(`${this.config.workspacePath}/${this.config.testFolderPath}`)
        ) {
            printError({ type: ErrorType.NOT_SOLIDITY_TEST_FILE, warning: true });
            return;
        }

        const soliditySourceUnit = await loadSoliditySourceUnit(
            this.config.solidityWorkspace,
            activeDocument.uri,
            false
        );
        const testFilePath = activeDocument.uri.path.replace(this.config.workspacePath + '/', '');
        const activePosition = activeEditor.selection.active;

        const testContracts = parseSoliditySourceUnit(soliditySourceUnit);
        let found = false;
        for (const contract of testContracts!) {
            if (matchType === MatchType.MatchContract) {
                const insideActivePosition = contract.range.contains(activePosition);
                if (insideActivePosition) {
                    found = true;
                    const testCase = new TestContract(testFilePath, contract.name, 0);
                    testCase.runInTerminal();
                }
            }

            if (matchType === MatchType.MatchTest) {
                for (const fn of contract.functions) {
                    const insideActivePosition = fn.range.contains(activePosition);
                    if (insideActivePosition) {
                        found = true;
                        const testCase = new TestCase(
                            testFilePath,
                            fn.contractName,
                            fn.name,
                            fn.type,
                            fn.fuzzed,
                            fn.signature,
                            fn.hash,
                            fn.expectedFail,
                            0
                        );
                        testCase.runInTerminal();
                    }

                    if (found) break;
                }
            }

            if (found) break;
        }
    }
}
