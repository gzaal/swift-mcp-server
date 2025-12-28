# Removing currying `func` declaration syntax

* Proposal: [SE-0002](0002-remove-currying.md)
* Author: [Joe Groff](https://github.com/jckarter)
* Status: **Implemented (Swift 3)**

## Introduction

Currying syntax in function declarations is of limited usefulness and adds complexity.
This proposal removes it from the language.

## Motivation

The curried function declaration syntax `func foo(x: Int)(y: Int)` was originally designed to provide sugar for declaring functions that return functions.

## Proposed solution

Remove the curried function declaration syntax from the language.

## Impact on existing code

Code using curried function definitions will need to be migrated.
