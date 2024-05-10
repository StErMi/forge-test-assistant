import { exec } from 'child_process';
import * as vscode from 'vscode';
import { MatchType, TestFunctionType, TraceLevel } from '../models';
import { parseTestResult, runTestInTerminal } from '../../utils/forge';
import { loadSoliditySourceUnit, parseSoliditySourceUnit } from '../../utils/solidity';

export type SolidityTestData = TestFile | TestContract | TestCase;
export const testData = new WeakMap<vscode.TestItem, SolidityTestData>();
let generationCounter = 0;

export class TestFile {
    public didResolve = false;

    public async updateFromDisk(
        workspacePath: string,
        solidityWorkspace: any,
        controller: vscode.TestController,
        item: vscode.TestItem,
        skipExistingPath: boolean
    ) {
        try {
            const soliditySourceUnit = await loadSoliditySourceUnit(solidityWorkspace, item.uri!, skipExistingPath);
            item.error = undefined;
            this.updateFromContents(workspacePath, controller, soliditySourceUnit, item);
        } catch (e) {
            item.error = (e as Error).stack;
        }
    }

    /**
     * Parses the tests from the input text, and updates the tests contained
     * by this file to be those from the text,
     */
    public updateFromContents(
        workspacePath: string,
        controller: vscode.TestController,
        soliditySourceUnit: any,
        item: vscode.TestItem
    ) {
        const ancestors = [{ item, children: [] as vscode.TestItem[] }];
        const thisGeneration = generationCounter++;
        this.didResolve = true;

        const ascend = (depth: number) => {
            while (ancestors.length > depth) {
                const finished = ancestors.pop()!;
                finished.item.children.replace(finished.children);
            }
        };

        // iterate over the solidity source unit to gather
        // all the contracts inside the file
        // and for each contract the test files
        const testFilePath = item.uri!.path.replace(workspacePath + '/', '');
        const testContracts = parseSoliditySourceUnit(soliditySourceUnit)!;
        for (const contract of testContracts) {
            if (contract.functions.length > 0) {
                ascend(1);
                const parent = ancestors[ancestors.length - 1];
                const data = new TestContract(testFilePath, contract.name, thisGeneration);
                const id = `${item.uri}/${data.getLabel()}`;
                const thead = controller.createTestItem(id, data.getLabel(), item.uri);
                thead.range = new vscode.Range(
                    new vscode.Position(contract.range.start.line - 1, contract.range.start.character),
                    new vscode.Position(contract.range.end.line, contract.range.end.character)
                );
                testData.set(thead, data);
                parent.children.push(thead);
                ancestors.push({ item: thead, children: [] });

                // add all the functions
                for (const fn of contract.functions) {
                    const parent = ancestors[ancestors.length - 1];
                    const data = new TestCase(
                        testFilePath,
                        fn.contractName,
                        fn.name,
                        fn.type,
                        fn.fuzzed,
                        fn.signature,
                        fn.hash,
                        fn.expectedFail,
                        thisGeneration
                    );
                    const id = `${item.uri}/${data.getLabel()}`;

                    const tcase = controller.createTestItem(id, data.getLabel(), item.uri);
                    testData.set(tcase, data);
                    tcase.range = new vscode.Range(
                        new vscode.Position(fn.range.start.line - 1, fn.range.start.character),
                        new vscode.Position(fn.range.end.line, fn.range.end.character)
                    );
                    parent.children.push(tcase);
                }
            }
        }

        ascend(0); // finish and assign children for all remaining items
    }
}

export class TestContract {
    matchType = MatchType.MatchContract;

    constructor(
        private readonly testFilePath: string,
        private readonly contractName: string,
        public generation: number
    ) {}

    getLabel() {
        return `${this.contractName}`;
    }

    getCommand() {
        const target = this.contractName;
        const config = vscode.workspace.getConfiguration('forge-test-assistant');
        const trace = config.get<TraceLevel>('verbosity');
        const traceLevel = trace ? trace : '';
        return `forge test ${this.matchType} ${target} ${traceLevel}`;
    }

    runInTerminal() {
        runTestInTerminal(this.getCommand());
    }
}

export class TestCase {
    matchType = MatchType.MatchTest;

    constructor(
        private readonly testFilePath: string,
        private readonly contractName: string,
        private readonly functionName: string,
        private readonly type: TestFunctionType,
        private readonly fuzzed: boolean,
        private readonly signature: string,
        private readonly hash: string,
        private readonly expectFail: boolean,
        public generation: number
    ) {}

    getLabel() {
        return `${this.functionName} | Fuzz: ${this.fuzzed ? '✅' : '❌'}  | Expected: ${
            !this.expectFail ? '✅' : '❌'
        }`;
    }

    getCommand() {
        const target = this.functionName;
        const config = vscode.workspace.getConfiguration('forge-test-assistant');
        const trace = config.get<TraceLevel>('verbosity');
        const traceLevel = trace ? trace : '';
        return `forge test ${this.matchType} ${target} ${traceLevel}`;
    }

    async run(workspacePath: string, item: vscode.TestItem, options: vscode.TestRun): Promise<void> {
        const startTS = new Date().getTime();
        options.appendOutput(
            `Running test: path ${this.testFilePath} | name ${this.contractName}:${this.functionName} | type ${
                this.type === TestFunctionType.TEST ? 'Test' : 'Invariant'
            } | Fuzzed: ${this.fuzzed} | Expected ${!this.expectFail ? '✅' : '❌'}\r\n`
        );
        options.appendOutput(`├── Command: ${this.getCommand()}\r\n`);
        return new Promise((resolve) => {
            exec(`${this.getCommand()} --json`, { cwd: workspacePath }, (err, stdout, stderr) => {
                // when the forge test fails (assertion) it returns an error object anyway
                // we want to handle it in a gentle way. if the process has been killed or
                // has no stderr just trigger the errored event
                if (err && stderr.length > 0) {
                    const duration = new Date().getTime() - startTS;
                    options.errored(item, new vscode.TestMessage(`${err.message}\n\n${stdout}`), duration);
                } else {
                    const result = parseTestResult(
                        this.testFilePath,
                        this.contractName,
                        this.fuzzed,
                        this.signature,
                        this.expectFail,
                        stdout
                    );
                    const durationMS = result.duration.secs * 1000 + result.duration.nanos / 1_000_000;

                    options.appendOutput(
                        `└── Result: ${result.success ? '✅' : '❌'} | Duration: ${durationMS}ms | Gas: ${
                            result.gas
                        }\r\n`
                    );
                    if (result.success) {
                        options.passed(item, durationMS);
                    } else {
                        // TODO: what's the proper way to parse the forge error to display in a more user friendly way
                        // where the test has failed?
                        const errors = result.errors.join(' | ');
                        options.appendOutput(`└── Errors: ${errors}\r\n`);
                        options.failed(item, new vscode.TestMessage(errors), durationMS);
                    }
                }

                resolve();
            });
        });
    }

    runInTerminal() {
        runTestInTerminal(this.getCommand());
    }
}
