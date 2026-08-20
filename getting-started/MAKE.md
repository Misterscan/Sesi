# Object Templates with `make`

`make` declares a reusable, class-like object template. Calling the template
creates a fresh object with its own fields and bound methods.

```sesi
make Person {
  let kind = "person"

  fn start(self, name, age = 0) {
    self.name = name
    self.age = age
  }

  fn greet(self) {
    return "Hello, I am " + self.name
  }
}

let ada = Person("Ada", 36)
show ada.name
show ada.greet()
```

## Constructors

Name the constructor `start`. Its first parameter must be `self`; the
remaining parameters become the arguments accepted by the template:

```sesi
make Point {
  fn start(self, x, y = 0) {
    self.x = x
    self.y = y
  }
}

let origin = Point(0)
let target = Point(4, 7)
```

A template can omit a constructor when it does not need arguments.

## Fields

Top-level `let` declarations in a `make` block become instance fields. Their
values are evaluated each time an object is created, so mutable state is not
shared between instances.

```sesi
make Counter {
  let count = 0

  fn increment(self) {
    self.count = self.count + 1
    return self.count
  }
}

let first = Counter()
let second = Counter()
first.increment()

show first.count   // 1
show second.count  // 0
```

## Methods

Every method must declare `self` as its first parameter. Sesi binds `self`
automatically when the method is accessed through an instance, so callers do
not pass it:

```sesi
make Greeter {
  fn greet(self, name) {
    return "Hello, " + name
  }
}

let greeter = Greeter()
show greeter.greet("Sesi")
```

`make` currently provides construction, instance fields, and instance
methods. Inheritance and static members are not part of this feature.
