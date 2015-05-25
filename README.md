# Decorators
This is a collection of ES7 decorators, and should be useful for a variety of
situations.

There are a few caveats, and you need to make sure you understand them
before you use these decorators. Firstly they are only useful if you have a
transpiler with support for decorators, as one might suspect.

## Memonize
The memonize decorator uses `WeakMap` to ensure that all cached values are
properly garbage collected. However it has to do a fair amount of work to
correctly map input arguments to output value for decorated methods and
classes.

For classes to support being called with new it uses accessors to proxy method
calls and property accesses to instances of the decorated class. This both
means there is some overhead involved with every operation but also that you
have to set all properties that will be used by an instance in the constructor
for it to be properly proxied. Lastly the instance cache is unbounded, and will
leak.

A better way is to decorate a static method that in turn instantiate the class.
This way you don't need to worry about stray properties or the performance
penalty from all the accessors. The reason this has to be this way is because
you cannot return values when you are being called with `new`. That is, in
`new Foo()`, anything returned by `Foo` is ignored.

For accessors the memonize decorator adds only a small amount of overhead, and
can be used more freely. If you don't specify a setter, a default one will be
created to allow clearing its cached value. This default setter only accepts
`undefined`, and will throw a `TypeError` if it receives something else.

## Curry
It uses `function.length` to determine when to curry and when to call, this
means that you can't curry have rest parameters, `(...args)`. But you can curry
before those, and if you call the curried function with more parameters they
will be forwarded to the decorated method. It will also preserve the `this`
value of the first call, which means you can use an empty paramters list to
easily get a bound method, `bar = foo.bar(); bar(1, 2) // this === foo`.

For classes it prohibits the use of `new`, see above, but otherwise it works
just the same.

### The gory details
For those who want to know how it works, just read the source. But here are
some highlights.

The code snippet `bind.bind(foo, bar)(...arguments)` is something you'll find
in a few places, and it is very useful if you want to call
`Function.prototype.bind` with a variable number of arguments without
converting the `arguments` object in between. This works by binding the `foo`
function/method to `bind`, essentially defering a call to `foo.bind`, but also
prefill/curry one more paramter, `bar`. This means `bind.bind(foo, bar)` is
something like `foo.bind(bar, ...)` since the call to `bind` has been deferred.
Since `bind.bind(foo, bar)(...arguments)` becomes/compiles to
`bind.bind(foo, bar).apply(undefined, arguments)` which because of the deferred
call to bind splats the arguments object into that call. It is like
`foo.bind(bar,...arguments)` but without inefficent handling of `arguments`.

In order to correctly match input arguments to output value it needs to both
respect ordering as well as paramter values. This is further complicated by
reference values. The approch taken by this library is to tag reference values
using a `WeakMap` and a guuid counter. This menas it has reference based
equality semanics, instead of value based.

