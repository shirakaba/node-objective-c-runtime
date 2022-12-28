const { objc, sel } = require(".");

const { isClass, isClassInstance, getClass, getClassName, msgSend } = objc;
const { registerName } = sel;

const proxiedObjcClassCache = {};
const proxiedObjcClassInstanceCache = new WeakMap();

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
      console.log(`construct()`, ...args);
      return this.get(target, "alloc")().init();
    },
    has(target, prop, receiver) {
      console.log(`has('${prop}')`);
      return Reflect.has(...arguments);
    },
    getOwnPropertyDescriptor(target, prop) {
      console.log(`getOwnPropertyDescriptor('${prop}')`);
      return Reflect.getOwnPropertyDescriptor(...arguments);
    },
    getPrototypeOf(target, prop, receiver) {
      console.log(`getPrototypeOf('${prop}')`);
      return Reflect.getPrototypeOf(...arguments);
    },
    ownKeys(target) {
      console.log(`ownKeys('${prop}')`);
      return Reflect.ownKeys(...arguments);
    },
    get(target, prop, receiver) {
      console.log(`get('${prop}')`);
      if ([...Object.keys(target), "toString"].includes(prop)) {
        return Reflect.get(...arguments);
      }

      return (...args) => {
        // TODO: marshal any args from JS into native as necessary - unless this
        // is already largely be handled for us on the native side.
        const result = msgSend(target.native, registerName(prop), ...args);

        return marshallObjcValueToJs(result);
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
      console.log(`construct()`, ...args);
      return this.get(target, "alloc")().init();
    },
    has(target, prop, receiver) {
      console.log(`has('${prop}')`);
      return Reflect.has(...arguments);
    },
    getOwnPropertyDescriptor(target, prop) {
      console.log(`getOwnPropertyDescriptor('${prop}')`);
      return Reflect.getOwnPropertyDescriptor(...arguments);
    },
    getPrototypeOf(target, prop, receiver) {
      console.log(`getPrototypeOf('${prop}')`);
      return Reflect.getPrototypeOf(...arguments);
    },
    ownKeys(target) {
      console.log(`ownKeys('${prop}')`);
      return Reflect.ownKeys(...arguments);
    },
    get(target, prop, receiver) {
      console.log(`get('${prop}')`);
      if ([...Object.keys(target), "toString"].includes(prop)) {
        return Reflect.get(...arguments);
      }

      return (...args) => {
        // TODO: marshal any args from JS into native as necessary - unless this
        // is already largely be handled for us on the native side.
        const result = msgSend(target.native, registerName(prop), ...args);

        return marshallObjcValueToJs(result);
      };
    },
  });

  proxiedObjcClassInstanceCache.set(classInstance, proxy);
  return proxy;
}

function marshallObjcValueToJs(result) {
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

const stringA = msgSend(
  msgSend(getClass("NSString"), registerName("alloc")),
  registerName("initWithString:"),
  "Hello"
);

const str = classes.NSString;
// console.log(str);

// console.log("isClass(classes.NSString)", isClass(str));
// console.log("isClass(classes.NSString.native)", isClass(str.native));
// console.log("isClass(getClass('NSString'))", isClass(getClass("NSString")));
// console.log("isClass(null)", isClass(null));
// console.log("isClass(stringA)", isClass(stringA));

// console.log("isClassInstance(classes.NSString)", isClassInstance(str));
// console.log("isClassInstance(classes.NSString.native)", isClassInstance(str.native));
// console.log("isClassInstance(getClass('NSString'))", isClassInstance(getClass("NSString")));
// console.log("isClassInstance(null)", isClassInstance(null));
// console.log("isClassInstance(stringA)", isClassInstance(stringA));

// console.log("getClassName(stringA)", getClassName(stringA));
// console.log("getClassName(classes.NSString.native)", getClassName(classes.NSString.native));

const alloc = str.alloc();
console.log(alloc);
const init = alloc.init();
console.log(init);

const nue = new str();
console.log(nue);

// console.log(classes.NSString);
