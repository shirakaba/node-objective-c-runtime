const { objc, sel } = require(".");

const { getClass, msgSend } = objc;
const { registerName } = sel;

const classes = new Proxy(
  {},
  {
    get(target, className, receiver) {
      console.log(`Get className ${className}`);
      /** @type {Buffer} */
      const classInstance = getClass(className);

      return new Proxy(
        {
          instance: classInstance,
          toString() {
            let address = [];
            for (let i = 0, length = classInstance.length; i < length; i++) {
              address.push(`${classInstance[i].toString(16).padStart(2, "0")}`);
            }

            return `<${className} ${address.join(" ")}>`;
          },
          [Symbol.for("nodejs.util.inspect.custom")](
            depth,
            inspectOptions,
            inspect
          ) {
            return this.toString();
          },
        },
        {
          // `new classes.NSString()` -> `classes.NSString.alloc().init()`
          construct(target, args) {
            console.log(`construct()`, ...args);
            // return msgSend(
            //   msgSend(target, registerName('alloc')),
            //   registerName('init'),
            // );
            return target.instance.alloc().init();
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
            return (...args) =>
              msgSend(target.instance, registerName(prop), ...args);
          },
        }
      );
    },
  }
);

const str = classes.NSString;
const alloc = str.alloc();
// const init = str.alloc().init();
// const nue = new str();

console.log(str);
console.log(alloc);
// console.log(init);
console.log(nue);

// console.log(classes.NSString);
