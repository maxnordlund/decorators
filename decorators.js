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
 * @param {(Object.<string, boolean>|...string)} options either a list of keys
 *        to enable or a map of options to set explicitly.
 */
export function ability(options, ...rest) {
  if (typeof options === "string") {
    options = { [options]: true }
    rest.forEach((name) => options[name] = true)
  }

  return (target, name, descriptor) => {
    descriptorAccessKeys.forEach((name) => descriptor[name] = !!options[name])
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
  if (typeof target === "boolean") return configurable.bind(target)
  descriptor.configurable = (this instanceof Boolean) ? this.valueOf(): true
}

/**
 * Sets the enumerable access option on the decorated property.
 *
 * @param {boolean} [enumerability=true] to set, defaults to `true`
 */
export function enumerable(target, name, descriptor) {
  if (typeof target === "boolean") return enumerable.bind(target)
  descriptor.enumerable = (this instanceof Boolean) ? this.valueOf(): true
}

/**
 * Sets the writable access option on the decorated property.
 *
 * @param {boolean} [writability=true] to set, defaults to `true`
 */
export function writable(target, name, descriptor) {
  if (typeof target === "boolean") return writable.bind(target)
  descriptor.writable = (this instanceof Boolean) ? this.valueOf(): true
}

/**
 * @callback use~target
 * @param {...*} [parameters] for the targeted function
 * @return {*} return value of the targeted function
 */

/**
 * @callback use~advice
 * @param {use~target} target to wrap with this advice
 * @return {use~target} wrapper function which applies this advice to the target
 */

/**
 * @callback use~accessor
 * @param {use~target} getter to wrap with this advice
 * @param {use~target} setter to wrap with this advice
 * @return {{getter: use~target, setter: use~target}} wrapped accessor pair
 */

/**
 * @typedef {Object} use~aspect
 * @property {use~advice} class class specfic advice if value hasn't been set
 * @property {use~advice} value decorator
 * @property {use~accessor} accessor decorator for both the getter/setter part,
 *           if this is proved the get/set properties are ignored
 * @property {use~advice} get decorator for the getter part of an accessor
 * @property {use~advice} set decorator for the setter part of an accessor
 */

/**
 * Meta descriptor to (re)use simple wrapper function(s).
 *
 * @param {(use~aspect|use~advice)} wrapper either a single advice to apply too
 *        all types of descriptors, or an aspect mapping each type to an advice.
 *
 * @example <caption>Using Bluebirds method wrapper.</caption>
 * class MyClass {
 *   @use(Promise.method)
 *   willAlwaysReturnPromise() {
 *     return true
 *   }
 * }
 *
 * @example <caption>A simple logger decorator.</caption>
 * const logger = {
 *   class(klass) {
 *     console.log("Class", klass)
 *     return klass
 *   },
 *
 *   value(fn) {
 *     console.log("Method", fn.name, "taking", fn.length, "parameters")
 *     return fn
 *   }
 *
 *   get(getter) {
 *     console.log("Getter")
 *     return getter
 *   }
 * }
 *
 * @use(logger)
 * class MyClass {
 *   @use(logger)
 *   someMethod() {}
 *
 *   @use(logger)
 *   otherMethod() {}
 *
 *   @use(logger)
 *   get random() {
 *     return 4 // Chosen by fair dice roll
 *   }
 * }
 */
export function use(aspect) {
  if (typeof aspect === "function") {
    /** Wrap the input {@link use~advice} into an {@link use~aspect} */
    aspect = {
      class: aspect,
      value: aspect,
      get: aspect,
      set: aspect
    }
  }

  return (target, name, descriptor) => {
    if (typeof target === "function" && name == null && descriptor == null) {
      // Class decorator
      return aspect.class(target)
    } else if (descriptor.hasOwnProperty("value")) {
      // Method/value decorator
      descriptor.value = aspect.value(descriptor.value)
    } else {
      // Accessor decorator
      if (aspect.accessor) {
        const { get, set } = aspect.accessor(descriptor.get, descriptor.set)
        descriptor.get = get
        descriptor.set = set
      } else {
        if (aspect.get) descriptor.get = aspect.get(descriptor.get)
        if (aspect.set) descriptor.set = aspect.set(descriptor.get)
      }
    }
  }
}

/**
 * @callback use~accessor jQuery style property accessor function
 * @param {*} [value] sets the value if provided, just gets it otherwise
 * @return {*} current value for this property
 */

/**
 * Turn a jQuery style property accessor method into a proper ES2015 accessor.
 *
 * @param {accessor~method} method to decorate
 */
export function accessor(target, name, descriptor) {
  if (descriptor && descriptor.hasOwnProperty("value") && typeof descriptor.value !== "function") {
    throw new TypeError(`${name} is not a function`)
  } else if (descriptor && (descriptor.hasOwnProperty("get") || descriptor.hasOwnProperty("set"))) {
    throw new TypeError(`${name} is already an accessors`)
  } else if (typeof target === "function" && name == null && descriptor == null) {
    throw new TypeError(`Can not decorate class ${name}`)
  }

  descriptor.get = descriptor.set = descriptor.value
  delete descriptor.value
}

/**
 * Enables currying the decorated method/class.
 *
 * Works by checking the parameter length of the supplied function, and as such
 * it won't work with `arguments` shenanigans. If you're using a compile to JS
 * language make sure to check the compiled output.
 */
export const curry = use({
  accessor(_getter, _setter) { throw new TypeError(`Can not curry accessors`) },
  value(target) {
    if (typeof target !== "function") {
      throw new TypeError(`Can not curry non-function values`)
    }

    return function curried() {
      if (arguments.length < target.length) {
        return bind.bind(curried, this).apply(void 0, arguments)
      } else {
        return target.apply(this, arguments)
      }
    }
  }
})

/**
 * Memoize the decorated method/class.
 *
 * That is, for a given ordered set of parameters this will cache the results
 * and when the same parameters are used it wil serve the result from cache.
 *
 * This handles references as well, and uses WeakMaps behind the scenes to make
 * sure those references can be garbage collected. However this also means it
 * uses reference equality for parameter checking.
 *
 * Currently it has an unbound cache, save for the use of WeakMaps to scope the
 * cache to the `this` value of the method. This combined means that as the
 * instances of a class get garbage collected, so those their cache.
 */
export const memoize = use({
  class: function(target) {
    const cache = new Cache(target)

    return class MemoizedClass extends target {
      constructor(...parameters) {
        // Since `this` will always point to a new value, use `target` as context
        return cache.fetch(target, parameters, () => new target(...parameters))
      }
    }
  },
  value(target) {
    const cache = new Cashe(target)

    function memoized(...parameters) {
      return cache.fetch(this, parameters, () => target.apply(this, parameters))
    }

    Object.setPrototypeOf(memoized, target)
    memoized.prototype = Object.create(target.prototype)
  },
  accessor(getter, setter) {
    let cache, invalid = true

    return {
      get() {
        if (invalid) {
          cache = getter.call(this)
          invalid = false
        }
        return cache
      },
      set(value) {
        cache = void 0 // Clear the cache to avoid memory leaks
        invalid = true
        return setter.call(this, value)
      }
    }
  }
})

/**
 * A Map wrapper with a default value generator, a bit like in python/ruby.
 *
 * @private
 * @class
 */
class DefaultMap {
  constructor(store, fallback) {
    this.store = store
    this.fallback = fallback
  }

  get(key) {
    return this.fetch(key, this.fallback)
  }

  fetch(key, fallback) {
    if (!this.store.has(key)) this.store.set(key, fallback())
    return this.store.get(key)
  }
}

/**
 * A cache for a method/class
 *
 * This is very the bulk of the work for {@link memoize} is done.
 */
class Cache {
  /** The global unique identification counter */
  static guuid = 1

  /** This holds the weak references to all parameters any memozied function uses */
  static references = new DefaultMap(new WeakMap(), () => Cache.guuid++)

  /**
   * Turns the provided parameters list into a string, essentially hashing it.
   *
   * @param {Array} parameters to hash
   * @return {string} representing the parameters provided
   */
  static keyFrom(parameters) {
    return parameters.map((it) => {
      if (it == null) return `${it}` // `null` and `undefined`
      switch (typeof it) {
        case "object":
        case "function": // Reference types
          return `<${references.get(it)}>`
        case "string": // Quote strings to prevent collisions with other types
          return `"${it.replace('"', '\"')}"`
        default: // Primitive types
          return `${it}`
      }
    }).join(",")
  }

  constructor(target) {
    this.target = target
    this.store = new DefaultMap(new WeakMap(), () => new DefaultMap(new Map(), null))
  }

  /**
   * Gets a result from this cache using the provided context and parameters.
   *
   * If there is no result, it uses the provided fallback to fetch the result.
   * This is store in this cache for future reference.
   *
   * @param {Object} context for the fallback, aka `this`
   * @param {Array} parameters for the fallback
   * @param {Function} fallback for when the cache is empty, called with the above
   * @return {*} result from the fallback, or a cached ditto
   */
  fetch(context, parameters, fallback) {
    return this.store.get(context).fetch(Cache.keyFrom(parameters), fallback)
  }
}
