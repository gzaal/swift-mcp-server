# Keywords as Argument Labels

* Proposal: [SE-0001](0001-keywords-as-argument-labels.md)
* Author: [Doug Gregor](https://github.com/DougGregor)
* Status: **Implemented (Swift 2.2)**

## Introduction

Argument labels are an important part of the interface of a Swift function.
This proposal allows keywords to be used as argument labels.

## Motivation

Swift reserves a number of keywords that may not be used as identifiers.
However, some of these keywords are commonly used as argument labels.

## Proposed solution

Allow any keyword except `inout`, `var`, and `let` to be used as an argument label.

```swift
func foo(in bar: Int) { }
```

## Impact on existing code

This is a purely additive change with no impact on existing code.
