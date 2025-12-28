# Protocols

A protocol defines a blueprint of methods, properties, and other requirements.

## Protocol Syntax

You define protocols in a similar way to classes, structures, and enumerations:

```swift
protocol SomeProtocol {
    // protocol definition goes here
}
```

## Property Requirements

A protocol can require any conforming type to provide an instance property or type property with a particular name and type.

```swift
protocol FullyNamed {
    var fullName: String { get }
}
```

## Method Requirements

Protocols can require specific instance methods and type methods to be implemented by conforming types.

```swift
protocol RandomNumberGenerator {
    func random() -> Double
}
```
