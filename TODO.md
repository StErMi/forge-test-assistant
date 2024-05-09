# BEFORE RELEASE

-   [ ] Update README
-   [ ] Update package.json title and description
-   [ ] Prepare store page

# NEXT

-   [ ] Add support to "native" test contracts. Currently it will run function's test for each one found in the contract
-   [ ] Add support to invariant testing
-   [ ] Add support to test coverage
-   [ ] Improved Test Result print layout (?)
-   [ ] Improved reporting result when running Full Test Suite or Contract Test
-   [ ] TBD

# QUESTIONS

-   Normally forge test --mc XYZ runs all the test functions inherited by such contract. Should the extension do the same? Currently only display and runs functions that are directly found at contract's level

# TODO

-   [ ] Add "Run Test" UI button on top of the Contract name inside the test file
-   [ ] Add "Run Test" UI button on top of the Function name inside each test function (test\*) of a Test Contract
-   [ ] Add in some way an option to specify the default Trace level (now forced to -vv)
-   [ ] Find a good keyboard shortcut to execute "Run Active Test Contract"
-   [ ] Find a good keyboard shortcut to execute "Run Active Test Function"
-   [ ] Allow to configure the keyboard shortcut used for those tasks (is it possible?)
-   [ ] Add support to Forge Invariant Testing
-   [ ] ???

### TODO Match Test Function

A forge test function must

-   have the name of the function that starts with `test`
-   have the visibility of the function `public` or `external`
