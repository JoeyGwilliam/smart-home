When writing unit tests, following the AAA structure: 
* Assemble
* Action
* Assert

Do NOT use comments to indicate this structure.

Tests should contain ALL the information needed to understand the test, and ONLY the information needed to understand 
the test. A human should be able to read the test and understand it without having to look at any other code. 

Test names should follow the convention `test_{OUTCOME}_when_{CASE}`.

The test folder should replicate the structure of the files it is testing.
