const { objc, sel } = require(".");

const { isClass, isClassInstance, getClass, getClassName, msgSend } = objc;
const { registerName } = sel;

const proxiedObjcClassCache = {};
const proxiedObjcClassInstanceCache = new WeakMap();

const nativeProxySymbol = Symbol("native proxy");
function isNativeProxy(obj) {
  return !!obj?.[nativeProxySymbol];
}

const classes = new Proxy(
  {},
  {
    get(target, className, receiver) {
      return proxyObjcClass(className);
    },
  }
);

function proxyObjcClass(className) {
  if (proxiedObjcClassCache[className]) {
    return proxiedObjcClassCache[className];
  }

  class NSObjectWrapper {
    /** @type {Buffer} */
    static native = getClass(className);
    static nativeClass = NSObjectWrapper.native;
    static nativeClassName = className;
    static nativeType = "class";
    static [nativeProxySymbol] = true;

    static toString() {
      const address = [];
      for (let i = 0, length = NSObjectWrapper.native.length; i < length; i++) {
        address.push(
          `${NSObjectWrapper.native[i].toString(16).padStart(2, "0")}`
        );
      }

      return `<${NSObjectWrapper.nativeClassName} ${address.join(" ")}>`;
    }
    static [Symbol.for("nodejs.util.inspect.custom")]() {
      return NSObjectWrapper.toString();
    }
  }
  Object.defineProperty(NSObjectWrapper, "name", { value: className });

  const proxy = new Proxy(NSObjectWrapper, {
    // Proxies `new classes.NSString()` -> `classes.NSString.alloc().init()`
    construct(target, args) {
      return this.get(target, "alloc")().init();
    },
    get(target, prop, receiver) {
      console.log(`get('${prop}')`);
      if ([...Object.keys(target), "toString"].includes(prop)) {
        return Reflect.get(...arguments);
      }

      return (...args) => {
        const result = msgSend(
          target.native,
          registerName(prop),
          ...args.map(marshalJSValueToNative)
        );

        return marshalObjcValueToJs(result);
      };
    },
  });

  proxiedObjcClassCache[className] = proxy;
  return proxy;
}

/**
 * @param {Buffer} classInstance
 */
function proxyObjcClassInstance(classInstance) {
  // Avoid rewrapping an instance that we have already wrapped.
  const cached = proxiedObjcClassInstanceCache.get(classInstance);
  if (cached) {
    return cached;
  }

  const className = getClassName(classInstance);

  // TODO: implement equality methods
  class NSObjectWrapper {
    /** @type {Buffer} */
    static native = classInstance;
    static nativeClass = getClass(className);
    static nativeClassName = className;
    static nativeType = "class instance";
    static [nativeProxySymbol] = true;

    static toString() {
      const address = [];
      for (let i = 0, length = NSObjectWrapper.native.length; i < length; i++) {
        address.push(
          `${NSObjectWrapper.native[i].toString(16).padStart(2, "0")}`
        );
      }

      return `<${NSObjectWrapper.nativeClassName} ${address.join(" ")}>`;
    }
    static [Symbol.for("nodejs.util.inspect.custom")]() {
      return NSObjectWrapper.toString();
    }
  }
  Object.defineProperty(NSObjectWrapper, "name", {
    value: `${className}Instance`,
  });

  const proxy = new Proxy(NSObjectWrapper, {
    // Proxies `new classes.NSString()` -> `classes.NSString.alloc().init()`
    construct(target, args) {
      throw new TypeError("Class instances are not constructors.");
    },
    get(target, prop, receiver) {
      if (
        typeof prop === "symbol" ||
        [...Object.keys(target), "toString"].includes(prop)
      ) {
        return Reflect.get(...arguments);
      }

      console.log(`get('${prop}')`);

      return (...args) => {
        const result = msgSend(
          target.native,
          registerName(prop),
          ...args.map(marshalJSValueToNative)
        );

        return marshalObjcValueToJs(result);
      };
    },
  });

  proxiedObjcClassInstanceCache.set(classInstance, proxy);
  return proxy;
}

function marshalJSValueToNative(arg) {
  // For now, we just pull out the .native property from any native properties,
  // but there will be other cases to handle later.
  return isNativeProxy(arg) ? arg.native : arg;
}

function marshalObjcValueToJs(result) {
  if (!(result instanceof Buffer)) {
    console.log("Result was not a buffer", result);
    return result;
  }

  if (isClass(result)) {
    const className = getClassName(result);
    console.log(`Wrapping class ${className}`);
    // A bit of a wasted step (we ask for the class name only to call
    // `getClass(className)` on it) but allows us to reuse our cache,
    // which is keyed on className.
    return proxyObjcClass(className);
  }

  if (isClassInstance(result)) {
    console.log(`Wrapping class instance.`);
    return proxyObjcClassInstance(result);
  }

  console.log(
    "Result was a buffer, but neither a class nor a class instance.",
    result
  );

  return result;
}

const { NSString } = classes;

const hello = NSString.alloc()["initWithString:"]("Hello");

const str = NSString.alloc()
  ["initWithString:"]("Hello")
  ["stringByAppendingString:"](NSString.alloc()["initWithString:"]("World"));

console.log(str);
