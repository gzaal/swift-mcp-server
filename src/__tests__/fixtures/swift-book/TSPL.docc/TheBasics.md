# The Basics

Swift is a type-safe language for iOS, macOS, watchOS, and tvOS development.

## Constants and Variables

Constants and variables associate a name with a value of a particular type.
The value of a constant can't be changed once it's set, whereas a variable can be set to a different value in the future.

### Declaring Constants and Variables

Constants are declared with the `let` keyword.
Variables are declared with the `var` keyword.

```swift
let maximumNumberOfLoginAttempts = 10
var currentLoginAttempt = 0
```

## Type Safety and Type Inference

Swift is a type-safe language. A type safe language encourages you to be clear about the types of values your code can work with.

## Optionals

You use optionals in situations where a value may be absent. An optional represents two possibilities: either there is a value and you can unwrap the optional to access that value, or there isn't a value at all.

```swift
var serverResponseCode: Int? = 404
serverResponseCode = nil
```
