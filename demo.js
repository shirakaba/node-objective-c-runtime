const { objc, sel } = require(".");

const { isClass, isClassInstance, getClass, getClassName, msgSend } = objc;
const { registerName } = sel;

const wrappedObjcClassCache = {};

function wrapObjcClass(className){
  if(wrappedObjcClassCache[className]){
    return wrappedObjcClassCache[className];
  }

  class NSObjectWrapper {
    /** @type {Buffer} */
    static nativeClass = getClass(className);
    /**
     * @param {string} className
     */
    constructor(className) {
      /** @type {string} */
      this.nativeClassName = className;
    }
    toString() {
      const address = [];
      for (let i = 0, length = this.nativeClass.length; i < length; i++) {
        address.push(
          `${this.nativeClass[i].toString(16).padStart(2, "0")}`
        );
      }
  
      return `<${this.nativeClassName} ${address.join(" ")}>`;
    }
    [Symbol.for("nodejs.util.inspect.custom")]() {
      return this.toString();
    }
  }
  Object.defineProperty(NSObjectWrapper, "name", { value: className });
  // Allow nativeClass to be accessed both on the instance and on the class.
  // This allows us to send messages either to the class or an instance.
  Object.defineProperty(NSObjectWrapper.prototype, "nativeClass", {
    value: NSObjectWrapper.nativeClass,
  });

  wrappedObjcClassCache[className] = NSObjectWrapper;
  return NSObjectWrapper;
}


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
          if (prop === "toString" || prop === "nativeClass") {
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
              target.nativeClass,
              registerName(prop),
              ...args
            );
            if (!(result instanceof Buffer)) {
              return result;
            }
            console.log(`get('${prop}') gave a Buffer, so we'll wrap it.`);
            return result;
          };
        },
      });
    },
  }
);

const stringA = msgSend(
  msgSend(getClass('NSString'), registerName('alloc')),
  registerName('initWithString:'),
  'Hello',
);

const str = classes.NSString;
console.log(str);

console.log("isClass(classes.NSString)", isClass(str));
console.log("isClass(classes.NSString.nativeClass)", isClass(str.nativeClass));
console.log("isClass(getClass('NSString'))", isClass(getClass("NSString")));
console.log("isClass(null)", isClass(null));
console.log("isClass(stringA)", isClass(stringA));

console.log("isClassInstance(classes.NSString)", isClassInstance(str));
console.log("isClassInstance(classes.NSString.nativeClass)", isClassInstance(str.nativeClass));
console.log("isClassInstance(getClass('NSString'))", isClassInstance(getClass("NSString")));
console.log("isClassInstance(null)", isClassInstance(null));
console.log("isClassInstance(stringA)", isClassInstance(stringA));

console.log("getClassName(stringA)", getClassName(stringA));
console.log("getClassName(classes.NSString.nativeClass)", getClassName(classes.NSString.nativeClass));

const alloc = str.alloc();
console.log(alloc);
// const init = str.alloc().init();

// const nue = new str();
// console.log(nue);

// console.log(init);

// console.log(classes.NSString);
