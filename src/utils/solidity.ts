import * as vscode from 'vscode';
import { ITestContract, TestFunctionType } from '../features/models';

export const parseSoliditySourceUnit = (soliditySourceUnit: any) => {
    let testContracts: ITestContract[] = [];

    // is it a valid solidity file with proper pragma definition?
    const validSolidityFile = soliditySourceUnit.pragmas.find(
        (e: any) => e.name === 'solidity' && e.type === 'PragmaDirective'
    );
    if (validSolidityFile === undefined) return;

    // iterate over each solidity contract inside the test file
    for (const contract of Object.values(soliditySourceUnit.contracts)) {
        const c = contract as any;

        // does it have a direct Forge Test import statement?
        const forgeTestImport = c._parent.imports.find(
            (e: any) => e.type === 'ImportDirective' && e.path === 'forge-std/Test.sol'
        );

        // does the contract inherit from the Test contract?
        // we are assuming that the inherited Test contract is the one from Forge
        // TODO: is there a batter way to determine this?
        const forgeTestFromLinearizedDependencies = c.linearizedDependencies.find(
            (e: any) => typeof e === 'string' && e === 'Test'
        );
        const isTestContract =
            forgeTestFromLinearizedDependencies !== undefined &&
            (forgeTestImport !== undefined || forgeTestFromLinearizedDependencies !== undefined);

        if (isTestContract) {
            const contractLoc = c._node.loc;
            const contractRange = new vscode.Range(
                new vscode.Position(contractLoc.start.line, contractLoc.start.column),
                new vscode.Position(contractLoc.end.line, contractLoc.end.column)
            );

            const testContract: ITestContract = {
                range: contractRange,
                name: c.name,
                functions: [],
            };

            // iterate over all the test functions
            for (const fnItem of Object.values(c.functions)) {
                const fn = fnItem as any;
                if (fn.name === null) {
                    // when does this happens? maybe the constructor or a modifier?
                    continue;
                }
                const isTestFunction = fn.name.startsWith('test');
                const expectFail = fn.name.startsWith('testFail');
                const isInvariantFunction = fn.name.startsWith('invariant');
                const isVisible = fn.visibility === 'public' || fn.visibility === 'external';
                if (isVisible && (isTestFunction || isInvariantFunction)) {
                    const fnLoc = fn._node.loc;
                    const fnRange = new vscode.Range(
                        new vscode.Position(fnLoc.start.line, fnLoc.start.column),
                        new vscode.Position(fnLoc.end.line, fnLoc.end.column)
                    );
                    const fnSig = fn.getFunctionSignature();
                    testContract.functions.push({
                        range: fnRange,
                        contractName: c.name,
                        name: fn.name,
                        type: isTestFunction ? TestFunctionType.TEST : TestFunctionType.INVARIANT,
                        fuzzed: Object.keys(fn.arguments).length > 0,
                        signature: fnSig.signature,
                        hash: fnSig.sighash,
                        expectedFail: expectFail,
                    });
                }
            }

            if (testContract.functions.length > 0) {
                testContracts.push(testContract);
            }
        }
    }

    return testContracts;
};

export const loadSoliditySourceUnit = async (solidityWorkspace: any, uri: vscode.Uri) => {
    const fsPath = uri.fsPath;
    const soliditySourceUnit = await solidityWorkspace.add(fsPath, {
        skipExistingPath: true,
    });
    // need to perform it two times to fully solve all the inhertances
    await solidityWorkspace.withParserReady(fsPath, true);
    await solidityWorkspace.withParserReady(fsPath, true);
    return soliditySourceUnit;
};
