/**
 * Collection of ES7 decorators
 */

const { hasOwnProperty, getOwnPropertyNames, getOwnPropertyDescriptor, defineProperty } = Object.prototype,
      { bind, call, apply } = Function.prototype

/**
 * Sets the supplied access options on the decorated property.
 *
 * Valid access options are in {@link descriptorAccessKeys}
 *
 * @param {Object.<string, boolean>|...string} options to set, either an object
 *                                                     or list of keys to enable
 */
export function ability(options, ...rest) {
  if (typeof options === "string") {
    options = { [options]: true }
    rest.forEach((name) => options[name] = true)
  }

  return (target, name, descriptor) => {
    descriptorAccessKeys.forEach((name) => descriptor[name] = options[name])
  }
}

/**
 * List of property descriptor keys for access control.
 */
const descriptorAccessKeys = Object.freeze([
  "configurable",
  "enumerable",
  "writable"
])

/**
 * Sets the configurable access option on the decorated property.
 *
 * @param {boolean} [configurability=true] to set, defaults to `true`
 */
export function configurable(target, name, descriptor) {
  if (typeof target === "boolean") return target::configurable
  descriptor.configurable = (this instanceof Boolean) ? this: true
}

/**
 * Sets the enumerable access option on the decorated property.
 *
 * @param {boolean} [enumerability=true] to set, defaults to `true`
 */
export function enumerable(target, name, descriptor) {
  if (typeof target === "boolean") return target::enumerable
  descriptor.enumerable = (this instanceof Boolean) ? this: true
}

/**
 * Sets the writable access option on the decorated property.
 *
 * @param {boolean} [writability=true] to set, defaults to `true`
 */
export function writable(target, name, descriptor) {
  if (typeof target === "boolean") return target::writable
  descriptor.writable = (this instanceof Boolean) ? this: true
}

export function use(aspect) {
  return (target, name, descriptor) => {
    if (typeof target === "function" && name == null && descriptor == null) {
      return aspect(target)
    } else if (descriptor::hasOwnProperty("value")) {
      descriptor.value = aspect(descriptor.value)
    } else {
      const { get: getter, set: setter } = descriptor
      descriptor.get = descriptor.set = aspect(function accessor(value) {
        if (arguments.length === 0) {
          return this::getter()
        } else {
          return this::setter(...arguments)
        }
      })
    }
  }
}

export function curry(target, name, descriptor) {
  if (descriptor && descriptor::hasOwnProperty("value") && typeof descriptor.value !== "function") {
    throw new TypeError(`Can not curry non-function values`)
  } else if (descriptor && (descriptor::hasOwnProperty("get") || descriptor::hasOwnProperty("set"))) {
    throw new TypeError(`Can not curry accessors`)
  }

  if (typeof target === "function" && name == null && descriptor == null) {
    // Class decorator
    return function curriedClass() {
      if (this instanceof curriedClass) {
        throw new TypeError(`Curried constructor ${target.name} prohibits use of 'new'`)
      }

      if (arguments.length < target.length) {
        return bind.bind(curriedClass, null)(...arguments)
      } else {
        return new (bind.bind(target, null)(...arguments))
      }
    }
  } else {
    // Method decorator
    const method = descriptor.value
    descriptor.value = function curriedMethod() {
      if (arguments.length < method.length) {
        return bind.bind(curriedMethod, this)(...arguments)
      } else {
        return this::method(...arguments)
      }
    }
  }
}

export function memoize(target, name, descriptor) {
  if (descriptor && descriptor::hasOwnProperty("value") && typeof descriptor.value !== "function") {
    throw new TypeError(`Can not memoize non-function values`)
  }

  if (typeof target === "function" && name == null && descriptor == null) {
    // Class decorator
    const store = new Map(),
          instances = new WeakMap(),
          bound = bind.bind(target, null)

    function init() {
      const curried = bound(...arguments)
      return () => new curried()
    }

    class MemoizedClass extends target {
      constructor() {
        instances.set(this, { store, init }::retrieveByArguments(...arguments))
        proxyProperties(instances, this, this)
      }
    }

    proxyProperties(instances, target.prototype, MemoizedClass.prototype)

    return MemoizedClass
  } else if (typeof descriptor.value === "function") {
    // Method decorator
    const cache = new WeakMap(),
          bound = new WeakMap(),
          method = descriptor.value

    descriptor.value = function memoizedMethod() {
      const init = retrieve(bound, this, () => bind.bind(method, this)),
            store = retrieve(cache, this, () => new Map())

      return { store, init }::retrieveByArguments(...arguments)
    }
  } else {
    // Accessor (getter/setter)
    const cache = new WeakMap(),
          { get: getter, set: setter } = descriptor

    descriptor.get = function memoizedGetter() {
      return retrieve(cache, this, this::getter)
    }

    descriptor.set = function memoizedSetter(value) {
      if (typeof setter === "function") {
        cache.set(this, this::setter(value))
      } else if (value === void 0) {
        cache.delete(this)
      } else {
        throw new TypeError(`Default memoized setter only accepts 'undefined'`)
      }
      return cache.get(this)
    }
  }
}

// Private helpers

let guuid = 1
const references = new WeakMap()

function retrieve(store, key, create) {
  store.has(key) || store.set(key, create())
  return store.get(key)
}

function retrieveByArguments() {
  return retrieve(this.store, keyFor(...arguments), this.init(...arguments))
}

function keyFor(...args) {
  return args.map((it) => {
    switch (typeof it) {
      case "object":
        if (it === null) return "null"
      case "function":
        return `<${retrieve(references, it, () => guuid++)}>`
      case "string":
        return `"${it.replace('"', '\"')}"`
      default:
        return `${it}`
    }
  }).join(",")
}

function proxyProperties(instances, src, dst) {
  getOwnPropertyNames(src).forEach((name) => {
    const descriptor = getOwnPropertyDescriptor(src, name)
    let { get: getter, set: setter, value, writable } = descriptor

    if (descriptor::hasOwnProperty("value")) {
      delete descriptor.value
      delete descriptor.writable

      getter = function valueGetter() { return this[name] }
      if (writable) {
        setter = function valueSetter(value) { return this[name] = value }
      }
    }

    if (typeof getter === "function") {
      descriptor.get = function get() { return instances.get(this)::getter() }
    }

    if (typeof setter === "function") {
      descriptor.set = function set(value) { return instances.get(this)::setter(value) }
    }

    defineProperty(dst, name, descriptor)
  })
}
