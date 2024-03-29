// -*- js-indent-level: 2 -*-
// Constructing patterns

'use strict';

function set(values) {
  var s = {};
  for (var i in values) {
    s[values[i]] = 1;
  }
  return s;
}

// Construct a segment bound to a variable, e.g., from a segment like
// "Len:32/unsigned-big". `specifiers0` is an array.
function variable(name, size, specifiers0) {
  var specifiers = set(specifiers0);
  var segment = {name: name};
  segment.type = type_in(specifiers);
  specs(segment, segment.type, specifiers);
  segment.size = size_of(segment, segment.type, size, segment.unit);
  if (segment.type == 'string') {
      add_string_specifiers(segment, specifiers);
  } else if (segment.type == 'binary') {
    add_binary_specifiers(segment, specifiers);
  }
  return segment;
}

module.exports.variable = variable;
module.exports.rest = function() {
  return variable('_', true, ['binary']);
}

// Construct a segment with a literal value, e.g., from a segment like
// "206". `specifiers0` is an array.

function value(val, size, specifiers0) {
  var specifiers = set(specifiers0);
  var segment = {value: val};
  segment.type = type_in(specifiers);
  // TODO check type v. value ..
  specs(segment, segment.type, specifiers);
  segment.size = size_of(segment, segment.type, size, segment.unit);
  return segment;
}

module.exports.value = value;

// A string can appear as a literal, but it must appear without
// specifiers.
function string(val) {
  return {value: val, type: 'string', size: Buffer.from(val, 'utf8').byteLength, unit: 8};
}
module.exports.string = string;

var TYPES = {'integer': 1, 'binary': 1, 'float': 1, 'string': 1, 'left': 1, 'right': 1, 'zero': 1, 'space': 1, 'bcd': 1};
function type_in(specifiers) {
  for (var t in specifiers) {
    if (TYPES[t]) { return t; }
  }
  return 'integer';
}

function specs(segment, type, specifiers) {
  switch (type) {
  case 'integer':
    segment.signed = signed_in(specifiers);
    // fall through
  case 'float':
    segment.bigendian = endian_in(specifiers);
    // fall through
  default:
    segment.unit = unit_in(specifiers, segment.type);
  }
  return segment;
}

function endian_in(specifiers) {
  // default is big, but I have chosen true = bigendian
  return !specifiers['little'];
}

function signed_in(specifiers) {
  // this time I got it right; default is unsigned
  return specifiers['signed'];
}

function unit_in(specifiers, type) {
  for (var s in specifiers) {
    if (s.substr(0, 5) == 'unit:') {
      var unit = parseInt(s.substr(5));
      // TODO check sane for type
      return unit;
    }
  }
  // OK defaults then
  switch (type) {
  case 'binary':
    return 8;
  case 'string':
    return 8;
  case 'bcd':
    return 8;
  case 'integer':
  case 'float':
    return 1;
  }
}

function size_of(segment, type, size, unit) {
  if (size !== undefined && size !== '' && size !== null) {
    return size;
  }
  else {
    switch (type) {
    case 'integer':
      return 8;
    case 'string':
      return null;
    case 'bcd':
      return 8;
    case 'float':
      return 64;
    case 'binary':
      return null;
    }
  }
}

function add_string_specifiers(segment, specifiers) {
  for (var s in specifiers) {
    if (s == 'left' || s == 'right' || s == 'zero' || s == 'space' || s == 'binhex' || s == 'hexbin' || s == 'bcd' || s == 'binary' || s == 'z') {
      if (s == 'binary' && ((parseInt(segment.size)/8) % 1) != 0) {
        throw "Segmen size must be divisible to 8!";
      }
      segment[s] = 1;
    }
  }
  return segment;
}

function add_binary_specifiers(segment, specifiers) {
  for (var s in specifiers) {
    if (s == 'left' || s == 'right' || s == 'zero' || s == 'space' || s == 'binhex' || s == 'hexbin' || s == 'binary' || s == 'z') {
      segment[s] = 1;
    }
  }
  return segment;
}
