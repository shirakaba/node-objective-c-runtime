const { objc, sel } = require('.');

const { getClass, msgSend } = objc;
const { registerName } = sel;

const NSString = getClass('NSString');

const stringA = msgSend(
    msgSend(NSString, registerName('alloc')),
    registerName('initWithString:'),
    'Hello',
);

console.log(stringA);
