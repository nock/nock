'use strict';

function clone(o) {
	return JSON.parse(JSON.stringify(o));
}

function mixin(a, b) {
	if (! a) { a = {}; }
	if (! b) {b = {}; }
	a = clone(a);
	for(var prop in b) {
		a[prop] = b[prop];
	}
	return a;
}

module.exports = mixin;