import * as vscode from 'vscode';

export interface ExtensionConfig {
    solidityWorkspace: any;
    workspacePath: any;
    forgeConfig: { [key: string]: any };
    testFolderPath: string;
}

export interface ErrorToast {
    type: ErrorType;
    warning: boolean;
}

export enum ErrorType {
    MULTIWORKSPACE_NOT_SUPPORTED = 'Test Suite does not support multiworkspace at the moment',
    NO_FILE_OPEN = 'No file is open',
    NO_TEST_FUNCTION_SELECTED = 'The selected/active function is not a test/invariant function',
    NOT_SOLIDITY_FILE = 'Active file is not a Solidity file',
    NOT_SOLIDITY_TEST_FILE = 'Active file is not a Solidity Test file',
    NO_SOLIDITY_TEST_CONTRACT_FOUND = 'Active file does not contains a Contract that inherit from Test contract',
    MULTIPLE_SOLIDITY_TEST_CONTRACT_FOUND = 'Active file contains multiple Contracts that inherit from Test contract',
}

export enum TestFunctionType {
    TEST = 'test',
    INVARIANT = 'invariant',
}

export enum MatchType {
    MatchContract = '--mc',
    MatchTest = '--mt',
}

export enum TraceLevel {
    None = '',
    // Logs emitted during tests are also displayed. That includes assertion errors from tests, showing information such as expected vs actual.
    Level2 = '-vv',
    // Stack traces for failing tests are also displayed.
    Level3 = '-vvv',
    // Stack traces for all tests are displayed, and setup traces for failing tests are displayed.
    Level4 = '-vvvv',
    // Stack traces and setup traces are always displayed.
    Level5 = '-vvvvv',
}

export interface ForgeTestResult {
    success: boolean;
    gas: number;
    duration: {
        secs: number;
        nanos: number;
    };
    errors: string[];
}

export interface ITestContract {
    range: vscode.Range;
    name: string;
    functions: ITestFunction[];
}

export interface ITestFunction {
    range: vscode.Range;
    contractName: string;
    name: string;
    type: TestFunctionType;
    fuzzed: boolean;
    signature: string;
    hash: string;
    expectedFail: boolean;
}
