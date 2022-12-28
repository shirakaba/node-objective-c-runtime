const { classes } = require('./nativescript');

const { NSString } = classes;

const str = NSString.alloc()
  ["initWithString:"]("Hello")
  ["stringByAppendingString:"](NSString.alloc()["initWithString:"](", World!"));

console.log(str);
