// Compile patterns to recognisers and constructors

'use strict';

require('buffer-more-ints');
var $ = require('util').format;

var parse = require('./parse').parse;
var interp = require('./interp'),
  parse_int = interp.parse_int,
  parse_float = interp.parse_float,
  bcdToInt = interp.bcdToInt;
var construct = require('./constructor'),
  write_int = construct.write_int,
  write_float = construct.write_float;

var lines = [];
function $start() {
  lines = [];
}
function $line(/* format , args */) {
  lines.push($.apply(null, arguments));
}
function $result() {
  return lines.join('\n');
}

function bits_expr(segment) {
  if (typeof segment.size === 'string') {
    return $('%s * %d; if (!Number.isInteger(bits))  {return false; }', var_name(segment.size), segment.unit);
  }
  else {
    return (segment.size * segment.unit).toString();
  }
}

function get_number(segment) {
  $line('bits = %s;\n', bits_expr(segment));
  var parser = (segment.type === 'integer') ?
    'parse_int' : 'parse_float';
  var be = segment.bigendian, sg = segment.signed;
  $line("byteoffset = offset / 8; offset += bits");
  $line("if (offset > binsize) { return false; }");
  $line("else if (bits === 0) { result = null; }");
  $line("else { result = %s(bin, byteoffset, bits / 8, %s, %s); }",
        parser, be, sg);
}

function get_binary(segment) {
  $line("byteoffset = offset / 8;");
  if (segment.z) {
    $line(" var hasRes = false;");
    $line("for (var i = byteoffset; i < bin.length; i++) {");
    $line("  offset += 8;");
    $line("  var segm = binary[i];");
    $line("  if (segm === 0) {");
    $line(" hasRes=true; result = bin.slice(byteoffset, i); break; }");
    $line("}");
    $line(" if (!hasRes) { return false };");
  } else {
    if (segment.size === null) {
      $line("offset = binsize;");
      $line("result = bin.slice(byteoffset);");
    }
    else {
      $line("bits = %s;", bits_expr(segment));
      $line("offset += bits;");
      $line("if (offset > binsize) { return false; }");
      $line("else { result = bin.slice(byteoffset,",
          "byteoffset + bits / 8); }");
    }
  }
}

function get_string(segment) {
  $line("byteoffset = offset / 8;");
  if (segment.z) {
    $line("var strVal = ''; var strRes = '';");
    $line(" for (var i = byteoffset; i < bin.length; i++) {");
    $line("  offset += 8;");
    $line("  var segm = bin[i];");
    $line("  if (segm === 0) { strRes = strVal;");
    $line("    break; }");
    $line("  strVal += String.fromCharCode(segm);}");
    $line(" if (strRes == '') { return false };");
    $line(" result = strRes; ");
  } else {
    $line("bits = %s;", bits_expr(segment));
    $line("offset += bits;");
    $line("if (offset > binsize) { return false; }");
    $line("else { result = bin.toString('utf8', byteoffset, byteoffset + bits / 8); ");
    if (segment.hexbin) {
      $line(" result = (Buffer.from(result, 'hex')); }");
    } else if (segment.binhex) {
      $line(" result = bin.toString('hex', byteoffset, byteoffset + bits / 8); }");
    } else if (segment.bcd) {
      $line(" result = bin.toString('hex', byteoffset, byteoffset + bits / 8); }");
      $line(" var regex = new RegExp(/^[0123456789]+$/); ");
      $line(" if (result !== '' && !regex.test(result)) { throw 'Invalid decimal string value!'; } ");
    } else if (segment.binary) {
      $line(" var regex = new RegExp(/^[01]+$/); ");
      $line(" if (!regex.test(result)) { throw 'Invalid binary string value!'; } ");
      $line(" var bytesCount = result.length / 8; ");
      $line(" var resString = ''; ");
      $line(" for (var k = 0; k < bytesCount; k++) { ");
      $line(" var chrInt = parseInt(result.substr((k * 8), 8), 2); ");
      $line(" resString += String.fromCharCode(chrInt); } ");
      $line(" result = resString; }");
    } else {
      $line(" }");
    }
  }
}

function get_bcd(segment) {
  $line("byteoffset = offset / 8;");
  $line("bits = %s;", bits_expr(segment));
  $line("offset += bits;");
  $line("if (offset > binsize) { return false; }");
  $line("else { var buf = bin.slice(byteoffset,byteoffset + bits / 8);" );
  $line(" result = bcdToInt(buf); }");
}

function skip_bits(segment) {
  if (typeof segment.size === 'string') {
    // Damn. Have to look up the size.
    $line("var skipbits = %s * %d;",
          var_name(segment.size), segment.unit);
    $line("if (offset + skipbits > binsize) { return false; }");
    $line("else { offset += skipbits; }");
  }
  else if (segment.size === null) {
    $line("if (offset % 8 === 0) { offset = binsize; }");
    $line("else { return false; }");
  }
  else {
    var bits = segment.unit * segment.size;
    $line("if (offset + %d > binsize) { return false; }", bits);
    $line("else { offset += %d; }", bits);
  }
}

function match_seg(segment) {
  if (segment.name === '_') {
    skip_bits(segment);
  }
  else {
    var assign_result;
    switch (segment.type) {
    case 'integer':
    case 'float':
      get_number(segment);
      break;
    case 'binary':
      get_binary(segment);
      break;
    case 'string':
      get_string(segment);
      break;
    case 'bcd':
      get_bcd(segment);
      break;
    }
    $line("if (result === false) return false;");
    if (segment.name) {
      // variable is given a value in the environment
      $line("else if (%s !== undefined) {", var_name(segment.name));
      // .. and it is not the same as that matched
      $line("if (%s != result) return false;",
            var_name(segment.name));
      $line("}");
      // variable is free
      $line('else %s = result;', var_name(segment.name));
    }
    else {
      var repr = JSON.stringify(segment.value);
      $line("else if (result != %s) return false;", repr);
    }
  }
}

function var_name(name) {
  return  'var_' + name;
}

function variables(segments) {
  var names = {};
  for (var i = 0; i < segments.length; i++) {
    var name = segments[i].name;
    if (name && name !== '_') {
      names[name] = true;
    }
    name = segments[i].size;
    if (typeof name === 'string') {
      names[name] = true;
    }
  }
  return Object.keys(names);
}

function compile_pattern(segments) {
  $start();
  $line("return function(binary, env) {");
  $line("'use strict';");
  $line("var bin = binary, env = env || {};");
  $line("var offset = 0, binsize = bin.length * 8;");
  $line("var bits, result, byteoffset;");
  var varnames = variables(segments);
  for (var v = 0; v < varnames.length; v++) {
    var name = varnames[v];
    $line("var %s = env['%s'];", var_name(name), name);
  }

  var len = segments.length;
  for (var i = 0; i < len; i++) {
    var segment = segments[i];
    $line("// " + JSON.stringify(segment));
    match_seg(segment);
  }

  $line("if (offset == binsize) {");
  $line("return {");
  for (var v = 0; v < varnames.length; v++) {
    var name = varnames[v];
    $line("%s: %s,", name, var_name(name));
  }
  $line('};');
  $line('}'); // if offset == binsize
  $line("else return false;");
  $line("}"); // end function

  var fn = new Function('parse_int', 'parse_float', 'bcdToInt', $result());
  return fn(parse_int, parse_float, bcdToInt);
}


function write_seg(segment) {
  switch (segment.type) {
  case 'string':
    if (segment.value === undefined) { // string variable
      var padChar = segment.space != undefined ? ' ' : '0';
      var padDirection = segment.right != undefined ? 'Right' : 'Left';

      $line("offset += buf.write(pad%s(String(bindings['%s']),'%s',%d), offset, 'utf8');", padDirection, segment.name, padChar, segment.size);
    } else { // string constant
      $line("offset += buf.write(%s, offset, 'utf8');",
            JSON.stringify(segment.value));
    }
    break;
  case 'binary':
    $line("val = bindings['%s'];", segment.name);
    if (segment.size === null) {
      $line('size = val.length;');
    }
    else if (typeof segment.size === 'string') {
      $line("size = (bindings['%s'] * %d) / 8;",
            segment.size, segment.unit);
    }
    else {
      $line("size = %d;", (segment.size * segment.unit) / 8);
    }
    $line('val.copy(buf, offset, 0, size);');
    $line('offset += size;');
    break;
  case 'integer':
  case 'float':
    write_number(segment);
    break;
  }
}

function write_number(segment) {
  if (segment.name) {
    $line("val = bindings['%s'];", segment.name);
  }
  else {
    $line("val = %d", segment.value);
  }
  var writer = (segment.type === 'integer') ?
    'write_int' : 'write_float';
  if (typeof segment.size === 'string') {
    $line("size = (bindings['%s'] * %d) / 8;",
          segment.size, segment.unit);
  }
  else {
    $line('size = %d;', (segment.size * segment.unit) / 8);
  }
  $line('%s(buf, val, offset, size, %s);',
        writer, segment.bigendian);
  $line('offset += size;');
}

function size_of(segments) {
  var variable = [];
  var fixed = 0;

  for (var i = 0; i < segments.length; i++) {
    var segment = segments[i];
    if (typeof segment.size === 'string' ||
        segment.size === null) {
      variable.push(segment);
    }
    else if (segment.type === 'string') {
      if (segment.value === undefined) { // string variable
        fixed += (segment.size * segment.unit) / 8;
      } else { // string constant
        fixed += Buffer.byteLength(segment.value);
      }
    }
    else {
      fixed += (segment.size * segment.unit) / 8;
    }
  }

  $line('var buffersize = %d;', fixed);

  if (variable.length > 0) {
    for (var j = 0; j < variable.length; j++) {
      var segment = variable[j];
      if (segment.size === null) {
        $line("buffersize += bindings['%s'].length;", segment.name);
      }
      else {
        $line("buffersize += (bindings['%s'] * %d) / 8;",
              segment.size, segment.unit);
      }
    }
  }
}

function emit_write(segments) {
  $line('var val, size;');

  var len = segments.length;
  for (var i = 0; i < len; i++) {
    var segment = segments[i];
    $line('// %s', JSON.stringify(segment));
    write_seg(segment);
  }
}

function compile_ctor(segments) {
  $start();
  $line('return function(bindings) {');
  $line("'use strict';");
  $line('function padLeft(str,pad,len){return (pad.repeat(len)+str).slice(-len)}');
  $line('function padRight(str,pad,len){return (str+pad.repeat(len)).substr(0,len)}');
  size_of(segments);
  $line('var buf = Buffer.alloc(buffersize);');
  $line('var offset = 0;');
  emit_write(segments);
  $line('return buf;');
  $line('}'); // end function

  return new Function('write_int', 'write_float',
                      $result())(write_int, write_float);
}

module.exports.compile_pattern = compile_pattern;
module.exports.compile = function() {
  var str = [].join.call(arguments, ',');
  var p = parse(str);
  return compile_pattern(p);
};
module.exports.compile_builder = function() {
  var str = [].join.call(arguments, ',');
  var p = parse(str);
  return compile_ctor(p);
};
