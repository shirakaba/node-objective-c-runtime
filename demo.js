const { objc, sel } = require(".");

const { getClass, msgSend } = objc;
const { registerName } = sel;

const classes = new Proxy(
  {},
  {
    get(target, className, receiver) {
      console.log(`Get className ${className}`);

      class ObjcClass {
        /** @type {Buffer} */
        static nativeClass = getClass(className);
        /**
         * @param {string} className
         */
        constructor(className){
          /** @type {string} */
          this.nativeClassName = className;
        }
        toString() {
          const address = [];
          for (let i = 0, length = this.nativeClass.length; i < length; i++) {
            address.push(`${this.nativeClass[i].toString(16).padStart(2, "0")}`);
          }

          return `<${this.nativeClassName} ${address.join(" ")}>`;
        }
        [Symbol.for("nodejs.util.inspect.custom")](
          depth,
          inspectOptions,
          inspect
        ) {
          return this.toString();
        }
      }
      Object.defineProperty (ObjcClass, 'name', { value: className });
      // Allow nativeClass to be accessed both on the instance and on the class.
      // This allows us to send messages either to the class or an instance.
      Object.defineProperty (ObjcClass.prototype, 'nativeClass', { value: ObjcClass.nativeClass });

      return new Proxy(
        ObjcClass,
        {
          // `new classes.NSString()` -> `classes.NSString.alloc().init()`
          construct(target, args) {
            console.log(`construct()`, ...args);
            // return msgSend(
            //   msgSend(target, registerName('alloc')),
            //   registerName('init'),
            // );
            // return this.alloc().init();
            return this.get(target, 'alloc')().init();
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
            if (prop === "toString") {
              return Reflect.get(...arguments);
            }
            // FIXME: if this returns a Buffer around an Obj-C class, we need to
            // wrap it with our proxy somehow. Same for class instance. And,
            // well, maybe ultimately every native data type.
            // This is why we can manage `classes.NSString.alloc()` but not
            // `classes.NSString.alloc().init()`.
            return (...args) =>
              msgSend(target.nativeClass, registerName(prop), ...args);
          },
        }
      );
    },
  }
);

const str = classes.NSString;
console.log(str);
const alloc = str.alloc();
console.log(alloc);
// const init = str.alloc().init();
const nue = new str();
console.log(nue);

// console.log(init);

// console.log(classes.NSString);
