import {use} from "./use.js"

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
 * @callback accessor~method jQuery style property accessor function
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
