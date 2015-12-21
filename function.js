import {use} from "./use.js"

/**
 * Ensures the decorated function is only called once.
 *
 * After the first call, all other calls will simply return the first result.
 */
export const once = use(function once(target) {
  let done = false,
      result = void 0

  if (typeof target !== "function") {
    throw new TypeError(`Can not decorate non-functions`)
  }

  return function wrapper() {
    if (done) return result
    done = true
    result = target.apply(this, arguments)
    return result
  }
})

/**
 * Ensures the decorated method is always bound to the expected `this` value.
 *
 * That is, it installs an accessor that binds the method on property access.
 * The net result is that even if you give a function reference to the method,
 * it will still be bound the instance it came from.
 */
export function bind(target, name, descriptor) {
  if (descriptor && descriptor.hasOwnProperty("value") && typeof descriptor.value !== "function") {
    throw new TypeError(`${name} is not a function`)
  } else if (descriptor && (descriptor.hasOwnProperty("get") || descriptor.hasOwnProperty("set"))) {
    throw new TypeError(`Can not bind accessor: ${name}`)
  } else if (typeof target === "function" && name == null && descriptor == null) {
    throw new TypeError(`Can not bind class: ${name}`)
  }

  const { value } = descriptor
  delete descriptor.value
  descriptor.get = function boundGetter() {
    return this[name] = value.bind(this) // Cache the binding on `this`
  }
  descriptor.set = function setter(value) {
    // Now you see me...
    Object.defineProperty(this, name, { value })
    // ...and now you don't
    return value
  }
}

/**
 * Throttles the decorated function.
 *
 * @param {number} [wait=300] time in milliseconds between invokations
 * @param {("leading"|"falling")} [edge="falling"] edge to trigger on
 */
export function throttle(wait = 300, edge = "falling") {
  let value = null

  switch (edge) {
    case "leading": value = leading.bind(wait); break
    case "falling": value = falling.bind(wait); break
    default: throw new TypeError(`Unknown edge "${edge}" given`)
  }

  return use({
    value,
    accessor(_getter, _setter) {
      throw new TypeError(`Can not throttle accessors`)
    }
  })
}

/** @private */
function leading(wait, target) {
  let timer = null
  return debounce() {
    const noTimer = !timer
    clearTimeout(timer)
    timer = setTimeout(() => { timer = null }, wait)

    if (noTimer) return target.apply(this, arguments)
  }
}

/** @private */
function falling(wait, target) {
  let timer = null
  return function debounce(...parameters) {
    if (timer) return

    timer = setTimeout(() => {
      timer = null
      target.apply(this, parameters)
    }, wait)
  }
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
    const cache = new Cache()

    return class MemoizedClass extends target {
      constructor(...parameters) {
        // Since `this` will always point to a new value, use `target` as context
        return cache.fetch(target, parameters, () => new target(...parameters))
      }
    }
  },
  value(target) {
    const cache = new Cache()

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
 *
 * @private
 * @class
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

  constructor() {
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
