const { objc, sel } = require(".");

const { isClass, isClassInstance, getClass, getClassName, msgSend } = objc;
const { registerName } = sel;

const wrappedObjcClassCache = {};
const wrappedObjcClassInstanceCache = new WeakMap();

const classes = new Proxy(
  {},
  {
    get(target, className, receiver) {
      console.log(`Get className ${className}`);

      const WrappedObjcClass = wrapObjcClass(className);

      return new Proxy(WrappedObjcClass, {
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
          if ([...Object.keys(WrappedObjcClass), "toString"].includes(prop)) {
            return Reflect.get(...arguments);
          }
          // FIXME: if this returns a Buffer around an Obj-C class, we need to
          // wrap it with our proxy somehow. Same for class instance. And,
          // well, maybe ultimately every native data type.
          // This is why we can manage `classes.NSString.alloc()` but not
          // `classes.NSString.alloc().init()`.
          return (...args) => {
            // TODO: marshal any args from JS into native as necessary -
            // unless this is already largely be handled for us on the native
            // side.
            const result = msgSend(
              target.native,
              registerName(prop),
              ...args
            );

            if (!(result instanceof Buffer)) {
              console.log('Result ');
              return result;
            }

            if(isClass(result)){
              const className = getClassName(result);
              console.log(`get(${prop}): wrapping class ${className}`);
              // A bit of a wasted step (we ask for the class name only to call
              // `getClass(className)` on it) but allows us to reuse our cache,
              // which is keyed on className.
              return wrapObjcClass(className);
            }

            if(isClassInstance(result)){
              console.log(`get(${prop}): wrapping class instance.`);
              return wrapObjcClassInstance(result);
            }

            // It's probably some other native thing that hasn't been
            // marshalled into a JS type, so just a missing feature.
            console.warn('Unexpectedly got a Buffer that is neither a class nor a class instance.');

            return result;
          };
        },
      });
    },
  }
);

function wrapObjcClass(className){
  if(wrappedObjcClassCache[className]){
    return wrappedObjcClassCache[className];
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

  wrappedObjcClassCache[className] = NSObjectWrapper;
  return NSObjectWrapper;
}

/**
 * @param {Buffer} classInstance 
 */
function wrapObjcClassInstance(classInstance){
  // Avoid rewrapping an instance that we have already wrapped.
  const cached = wrappedObjcClassInstanceCache.get(classInstance);
  if(cached){
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
  Object.defineProperty(NSObjectWrapper, "name", { value: `${className}` });

  wrappedObjcClassInstanceCache.set(classInstance, NSObjectWrapper);

  return NSObjectWrapper;
}

const stringA = msgSend(
  msgSend(getClass('NSString'), registerName('alloc')),
  registerName('initWithString:'),
  'Hello',
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

// const nue = new str();
// console.log(nue);


// console.log(classes.NSString);
