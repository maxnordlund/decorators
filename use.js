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
 * @property {use~advice} class class specfic advice if `value` hasn't been set
 * @property {use~advice} value decorator, mostly for decorating methods
 * @property {use~accessor} accessor decorator for both the getter/setter part,
 *           if this is provided the get/set properties below are ignored
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
