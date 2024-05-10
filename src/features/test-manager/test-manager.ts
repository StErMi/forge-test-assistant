import * as vscode from 'vscode';
import { ExtensionConfig } from '../models';
import { TestCase, TestFile, testData } from './test-tree';
import { loadSoliditySourceUnit, parseSoliditySourceUnit } from '../../utils/solidity';

export class TestManager {
    testController = vscode.tests.createTestController('solidityTestController', 'Solidity Tests');

    constructor(private readonly config: ExtensionConfig) {}

    async initialize(context: vscode.ExtensionContext) {
        // initialize the VSCode test controller
        // subscribe the test controller
        context.subscriptions.push(this.testController);

        const fileChangedEmitter = new vscode.EventEmitter<vscode.Uri>();
        const watchingTests = new Map<vscode.TestItem | 'ALL', vscode.TestRunProfile | undefined>();

        // File change handler
        fileChangedEmitter.event((uri) => {
            if (watchingTests.has('ALL')) {
                startTestRun(new vscode.TestRunRequest(undefined, undefined, watchingTests.get('ALL'), true));
                return;
            }

            const include: vscode.TestItem[] = [];
            let profile: vscode.TestRunProfile | undefined;
            for (const [item, thisProfile] of watchingTests) {
                const cast = item as vscode.TestItem;
                if (cast.uri?.toString() == uri.toString()) {
                    include.push(cast);
                    profile = thisProfile;
                }
            }

            if (include.length) {
                startTestRun(new vscode.TestRunRequest(include, undefined, profile, true));
            }
        });

        // Run handler
        const runHandler = (request: vscode.TestRunRequest, cancellation: vscode.CancellationToken) => {
            if (!request.continuous) {
                return startTestRun(request);
            }

            if (request.include === undefined) {
                watchingTests.set('ALL', request.profile);
                cancellation.onCancellationRequested(() => watchingTests.delete('ALL'));
            } else {
                request.include.forEach((item) => watchingTests.set(item, request.profile));
                cancellation.onCancellationRequested(() =>
                    request.include!.forEach((item) => watchingTests.delete(item))
                );
            }
        };

        // Test starter
        const startTestRun = (request: vscode.TestRunRequest) => {
            const queue: { test: vscode.TestItem; data: TestCase }[] = [];
            const run = this.testController.createTestRun(request);
            const discoverTests = async (tests: Iterable<vscode.TestItem>) => {
                for (const test of tests) {
                    if (request.exclude?.includes(test)) {
                        continue;
                    }

                    const data = testData.get(test);
                    if (data instanceof TestCase) {
                        run.enqueued(test);
                        queue.push({ test, data });
                    } else {
                        if (data instanceof TestFile && !data.didResolve) {
                            await data.updateFromDisk(
                                this.config.workspacePath,
                                this.config.solidityWorkspace,
                                this.testController,
                                test,
                                false
                            );
                        }

                        await discoverTests(this._gatherTestItems(test.children));
                    }
                }
            };

            const runTestQueue = async () => {
                for (const { test, data } of queue) {
                    if (run.token.isCancellationRequested) {
                        run.skipped(test);
                    } else {
                        run.started(test);
                        await data.run(this.config.workspacePath, test, run);
                    }
                }

                run.end();
            };

            discoverTests(request.include ?? this._gatherTestItems(this.testController.items)).then(runTestQueue);
        };

        this.testController.refreshHandler = async () => {
            await Promise.all(
                this._getWorkspaceTestPatterns().map(({ pattern }) => {
                    this._findInitialFiles(this.testController, pattern, true);
                })
            );
        };

        this.testController.createRunProfile(
            'Run Tests',
            vscode.TestRunProfileKind.Run,
            runHandler,
            true,
            undefined,
            true
        );

        this.testController.resolveHandler = async (item) => {
            // when `item` is undefined it means that we can trigger the whole workspace discovery
            if (!item) {
                context.subscriptions.push(
                    ...this._startWatchingWorkspace(
                        this.config.solidityWorkspace,
                        this.testController,
                        fileChangedEmitter
                    )
                );
                return;
            }

            // otherwise just load the solidity file information directly from the disk and update it if needed
            const data = testData.get(item);
            if (data instanceof TestFile) {
                await data.updateFromDisk(
                    this.config.workspacePath,
                    this.config.solidityWorkspace,
                    this.testController,
                    item,
                    false
                );
            }
        };

        // iterate over all the files and see if there are already available tests
        for (const document of vscode.workspace.textDocuments) {
            await this._updateNodeForDocument(document, true);
        }

        // when user open a file or change it content update the test file
        // `_updateNodeForDocument` will take care to skip the task if it's not a valid test file
        context.subscriptions.push(
            vscode.workspace.onDidOpenTextDocument((e) => this._updateNodeForDocument(e, false)),
            vscode.workspace.onDidChangeTextDocument((e) => this._updateNodeForDocument(e.document, false))
        );
    }

    private async _updateNodeForDocument(e: vscode.TextDocument, skipExistingPath: boolean) {
        // if it's not a file OR it's not a solidity file OR it's not inside the test folder -> ignore it
        if (
            e.uri.scheme !== 'file' ||
            !e.uri.path.endsWith('.sol') ||
            !e.uri.path.startsWith(`${this.config.workspacePath}/${this.config.testFolderName}`)
        ) {
            return;
        }

        const { file, data } = await this._getOrCreateFile(this.testController, e.uri, skipExistingPath);
        if (file) {
            const soliditySourceUnit = await loadSoliditySourceUnit(
                this.config.solidityWorkspace,
                e.uri,
                skipExistingPath
            );
            data.updateFromContents(this.config.workspacePath, this.testController, soliditySourceUnit, file);
        }
    }

    private async _findInitialFiles(
        controller: vscode.TestController,
        pattern: vscode.GlobPattern,
        skipExistingPath: boolean
    ) {
        vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                cancellable: false,
                title: 'Loading and parsing all test files...',
            },
            async (progress, token) => {
                const files = await vscode.workspace.findFiles(pattern);
                for (const _file of files) {
                    await this._getOrCreateFile(controller, _file, skipExistingPath);
                }
            }
        );
    }

    private _gatherTestItems(collection: vscode.TestItemCollection) {
        const items: vscode.TestItem[] = [];
        collection.forEach((item) => items.push(item));
        return items;
    }

    private _getWorkspaceTestPatterns() {
        if (!vscode.workspace.workspaceFolders) {
            return [];
        }

        return vscode.workspace.workspaceFolders.map((workspaceFolder) => ({
            workspaceFolder,
            pattern: new vscode.RelativePattern(workspaceFolder, `${this.config.testFolderName}/**/*.sol`),
        }));
    }

    private async _getOrCreateFile(controller: vscode.TestController, uri: vscode.Uri, skipExistingPath: boolean) {
        const existing = controller.items.get(uri.toString());
        if (existing) {
            return { file: existing, data: testData.get(existing) as TestFile };
        }

        const soliditySourceUnit = await loadSoliditySourceUnit(this.config.solidityWorkspace, uri, skipExistingPath);
        const solidityTestFile = parseSoliditySourceUnit(soliditySourceUnit);
        if (solidityTestFile!.length > 0) {
            const file = controller.createTestItem(uri.toString(), uri.path.split('/').pop()!, uri);
            controller.items.add(file);

            const data = new TestFile();
            testData.set(file, data);

            file.canResolveChildren = true;
            return { file, data };
        } else {
            return { file: undefined, data: undefined };
        }
    }

    private _startWatchingWorkspace(
        solidityWorkspace: any,
        controller: vscode.TestController,
        fileChangedEmitter: vscode.EventEmitter<vscode.Uri>
    ) {
        return this._getWorkspaceTestPatterns().map(({ workspaceFolder, pattern }) => {
            const watcher = vscode.workspace.createFileSystemWatcher(pattern);

            watcher.onDidCreate((uri) => {
                this._getOrCreateFile(controller, uri, true);
                fileChangedEmitter.fire(uri);
            });
            watcher.onDidChange(async (uri) => {
                const skipExistingPath = false;
                const { file, data } = await this._getOrCreateFile(controller, uri, skipExistingPath);
                if (data && data.didResolve) {
                    await data.updateFromDisk(
                        this.config.workspacePath,
                        solidityWorkspace,
                        controller,
                        file,
                        skipExistingPath
                    );
                }
                fileChangedEmitter.fire(uri);
            });
            watcher.onDidDelete((uri) => controller.items.delete(uri.toString()));

            this._findInitialFiles(controller, pattern, true);

            return watcher;
        });
    }
}
