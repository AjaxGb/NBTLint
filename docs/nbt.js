var NBT = {
	quotedCharRE: /[^a-zA-Z0-9._+\-]/,
	/**
	 * An NBT String tag
	 * @constructor
	 * @param {string} value - The tag's value
	 * @param {boolean} [isKey=false] - Whether the string is a TagCompound key
	 */
	TagString: function(value, isKey) {
		this.value = value;
		this.isKey = !!isKey;
		this.needQuotes = NBT.quotedCharRE.test(value);
		if (!this.needQuotes && !isKey) {
			var num;
			try {
				num = NBT._Parser.parseNumber(value);
			} catch (e) {
				return;
			}
			if (num) this.needQuotes = true;
		}
	},
	/**
	 * A generic NBT number tag
	 * @constructor
	 * @abstract
	 * @param {number} value - The tag's value
	 */
	TagNumber: function(value) {
		if (value > this.maxValue) throw {error: "value_too_high", type: this.constructor, max: this.maxValue};
		if (value < this.minValue) throw {error: "value_too_low",  type: this.constructor, min: this.minValue};
		this.value = value;
	},
	/**
	 * An NBT Byte tag
	 * @constructor
	 * @param {number} value - The tag's value. Must be a whole number (not enforced).
	 */
	TagByte: function(value) {
		NBT.TagNumber.call(this, value);
	},
	/**
	 * An NBT Short tag
	 * @constructor
	 * @param {number} value - The tag's value. Must be a whole number (not enforced).
	 */
	TagShort: function(value) {
		NBT.TagNumber.call(this, value);
	},
	/**
	 * An NBT Integer tag
	 * @constructor
	 * @param {number} value - The tag's value. Must be a whole number (not enforced).
	 */
	TagInteger: function(value) {
		NBT.TagNumber.call(this, value);
	},
	/**
	 * An NBT Long tag
	 * @constructor
	 * @param {string} value - The tag's value. NOT A NUMBER! Must be a string matching /^[-+]?(0|[1-9][0-9]*)$/
	 */
	TagLong: function(value) {
		var sign = value[0];
		if (sign === "+" || sign === "-") {
			value = value.substr(1);
		}
		
		if (value === "0") return this.value = 0;
		if (!/^[1-9][0-9]*$/.test(value)) throw {error: "invalid_format", message: "Badly formatted TagLong string"};
		if (value.length > 19) {
			if (sign === "-") throw {error: "value_too_low", type: NBT.TagLong, min: this.minValue};
			throw {error: "value_too_high", type: NBT.TagLong, max: this.maxValue};
		}
		if (value.length < 19) {
			if (sign === "-") return this.value = sign + value;
			return this.value = value;
		}
		
		var limit = (sign === "-") ? this.minValueSignless : this.maxValue;
		for (var i = 0; i < limit.length; ++i) {
			if (value[i] !== limit[i]) {
				if (value[i] < limit[i]) break;
				if (sign === "-") throw {error: "value_too_low", type: NBT.TagLong, min: this.minValue};
				throw {error: "value_too_high", type: NBT.TagLong, max: this.maxValue};
			}
		}
		
		if (sign === "-") return this.value = sign + value;
		return this.value = value;
	},
	/**
	 * An NBT Float tag
	 * @constructor
	 * @param {number} value - The tag's value.
	 */
	TagFloat: function(value) {
		value = value;
		if (value > this.maxValue) value =  "9e99";
		if (value < this.minValue) value = "-9e99";
		this.value = value;
	},
	/**
	 * An NBT Double tag
	 * @constructor
	 * @param {number} value - The tag's value.
	 */
	TagDouble: function(value) {
		value = value;
		if (value > this.maxValue) value =  "9e999";
		if (value < this.minValue) value = "-9e999";
		this.value = value;
	},
	/**
	 * An NBT Compound tag
	 * @constructor
	 * @param {Object} [values] - A dictionary of Tags to insert into the compound.
	 */
	TagCompound: function(values) {
		this.pairs = [];
		this.map = {};
		if (values) for (var k in values) {
			this.add(k, values[k]);
		}
	},
	/**
	 * An NBT List tag
	 * @constructor
	 * @param {Function} [type=undefined] - The type of the list. Leave undefined to auto-detect, or specify a Tag constructor.
	 * @param {NBT.Tag[]} [values] - An array of Tags to insert into the list.
	 */
	TagList: function(type, values) {
		this.type = type ? type : undefined;
		this.list = [];
		if (values) for (var i = 0; i < values.length; ++i) {
			this.push(values[i]);
		}
	},
	/**
	 * An NBT Byte Array tag
	 * @constructor
	 * @param {NBT.TagByte[]} [values] - An array of TagBytes to insert into the array.
	 */
	TagArrayByte: function(values) {
		NBT.TagList.call(this, NBT.TagByte, values);
	},
	/**
	 * An NBT Int Array tag
	 * @constructor
	 * @param {NBT.TagInteger[]} [values] - An array of TagIntegers to insert into the array.
	 */
	TagArrayInt: function(values) {
		NBT.TagList.call(this, NBT.TagInteger, values);
	},
	/**
	 * An NBT Long Array tag
	 * @constructor
	 * @param {NBT.TagLong[]} [values] - An array of TagLongs to insert into the array.
	 */
	TagArrayLong: function(values) {
		NBT.TagList.call(this, NBT.TagLong, values);
	},
	/**
	 * Convert an NBT.Tag to a textual representation
	 * @param {NBT.Tag} value - The Tag to stringify.
	 * @param {string} [space=\t] - The string to use for indentation.
	 *
	 * @param {Object}   [options] - Extra options.
	 * @param {Function} [options.sort]             - A sorting function to use on compound values. Recommended: NBT.compareAlpha, NBT.compareType, NBT.compareTypeAlpha.
	 * @param {boolean}  [options.quoteKeys]        - Force all keys to be quoted.
	 * @param {boolean}  [options.unquoteStrings]   - Avoid quoting non-key strings when possible.
	 * @param {boolean}  [options.deflate]          - Remove all unnecessary whitespace in the result.
	 * @param {Object}   [options.capitalizeSuffix] - Which number suffixes to capitalize.
	 * @param {NBT.Tag}  [options.capitalizeSuffix.default=false] - Whether to capitalize unmentioned suffixes.
	 *
	 * @returns {string}
	 */
	stringify: function(value, space, options) {
		if (space == null) space = "\t";
		options = options || {};
		options.capitalizeSuffix = options.capitalizeSuffix || {};
		return NBT._printValue(value, space, "", options);
	},
	/**
	 * Compare two key-value compound member pairs alphabetically.
	 * @param {Array} a - The first key-value pair.
	 * @param {Array} b - The second key-value pair.
	 * @returns {number} - The result of the comparison.
	 */
	compareAlpha: function(a, b) {
		var nameA = a[0].value, nameAI = nameA.toLowerCase(),
		    nameB = b[0].value, nameBI = nameB.toLowerCase();
		if (nameAI < nameBI) return -1;
		if (nameAI > nameBI) return  1;
		if (nameA < nameB) return -1;
		if (nameA > nameB) return  1;
		return 0;
	},
	/**
	 * Compare two key-value compound member pairs by the sortOrders of their types.
	 * @param {Array} a - The first key-value pair.
	 * @param {Array} b - The second key-value pair.
	 * @returns {number} - The result of the comparison.
	 */
	compareType: function(a, b) {
		var orderA = a[1].sortOrder,
		    orderB = b[1].sortOrder;
		if (orderA < orderB) return -1;
		if (orderA > orderB) return  1;
		if (a[1].constructor !== NBT.TagList) return 0;
		orderA = a[1].type.prototype.sortOrder;
		orderB = b[1].type.prototype.sortOrder;
		if (orderA < orderB) return -1;
		if (orderA > orderB) return  1;
		return 0;
	},
	/**
	 * Compare two key-value compound member pairs, first by the sortOrders of their types, then alphabetically.
	 * @param {Array} a - The first key-value pair.
	 * @param {Array} b - The second key-value pair.
	 * @returns {number} - The result of the comparison.
	 */
	compareTypeAlpha: function(a, b) {
		return NBT.compareType(a, b) || NBT.compareAlpha(a, b);
	},
	/**
	 * Sort a list while ensuring that items which compare equal stay in the same order relative to each other.
	 * @param {Array} list - The list to sort.
	 * @param {Function} cmp - The comparison function.
	 * @returns {Array} - The new sorted list.
	 */
	stableSorted: function(list, cmp) {
		cmp = cmp || function(a, b) {
			if (a < b) return -1;
			if (a > b) return 1;
			return 0;
		};
		var indexed = list.map(function(e, i) { return [e, i]; });
		indexed.sort(function(a, b) {
			return cmp(a[0], b[0]) || (a[1] - b[1]);
		});
		return indexed.map(function(e) { return e[0] });
	},
	_printValue: function(value, space, indent, options) {
		switch (value.constructor) {
		case NBT.TagString:
			return NBT._printString(value, options);
		case NBT.TagByte:
		case NBT.TagShort:
		case NBT.TagInteger:
		case NBT.TagLong:
		case NBT.TagFloat:
		case NBT.TagDouble:
			return NBT._printNumber(value, options);
		case NBT.TagCompound:
			return NBT._printCompound(value, space, indent, options);
		case NBT.TagList:
		case NBT.TagArrayByte:
		case NBT.TagArrayInt:
		case NBT.TagArrayLong:
			return NBT._printList(value, space, indent, options);
		}
	},
	_printString: function(str, options) {
		if (str.needQuotes || (str.isKey ? options.quoteKeys : !options.unquoteStrings)) {
			return '"' + str.value
				.replace(/\\/g, '\\\\')
				.replace(/"/g, '\\"') + '"';
		}
		return str.value;
	},
	_printNumber: function(number, options) {
		var cap = options.capitalizeSuffix[number.suffix];
		if (cap == null) cap = options.capitalizeSuffix["default"];
		return number.value + (cap ? number.suffix.toUpperCase() : number.suffix);
	},
	_printCompound: function(value, space, indent, options) {
		if (value.pairs.length === 0) return "{}";
		var oldIndent = indent,
			indent = oldIndent + space,
			list = value.pairs,
			l = list.length - 1,
			str = options.deflate ? "{" : "{\n",
			i;
		if (options.sort) {
			list = NBT.stableSorted(list, options.sort);
		}
		for (i = 0; i < l; ++i) {
			if (!options.deflate) str += indent;
			str += NBT._printString(list[i][0], options) + (options.deflate ? ":" : ": ");
			str += NBT._printValue(list[i][1], space, indent, options);
			str += options.deflate ? "," : ",\n";
		}
		if (!options.deflate) str += indent;
		str += NBT._printString(list[i][0], options) + (options.deflate ? ":" : ": ");
		str += NBT._printValue(list[i][1], space, indent, options);
		if (!options.deflate) str += "\n" + oldIndent;
		return str + "}";
	},
	_printList: function(value, space, indent, options) {
		if (value.list.length === 0) return "[" + value.arrayPrefix + "]";
		var l = value.list.length - 1,
			str = "[" + value.arrayPrefix,
			i;
		if (value.list[0] instanceof NBT.TagNumber || value.type === NBT.TagString) {
			// One line
			if (value.arrayPrefix && !options.deflate) str += " ";
			for (i = 0; i < l; ++i) {
				str += NBT._printValue(value.list[i], "", "", options) +
					(options.deflate ? "," : ", ");
			}
			return str + NBT._printValue(value.list[i], "", "", options) + "]";
		}
		// Multi-line
		var oldIndent = indent,
			indent = oldIndent + space;
		if (!options.deflate) str += "\n";
		for (i = 0; i < l; ++i) {
			if (!options.deflate) str += indent;
			str += NBT._printValue(value.list[i], space, indent, options);
			str += options.deflate ? "," : ",\n";
		}
		if (!options.deflate) str += indent;
		str += NBT._printValue(value.list[i], space, indent, options);
		if (!options.deflate) str += "\n" + oldIndent;
		return str + "]";
	},
	/**
	 * Parse the textual representation of an NBT Tag.
	 * @param {string} value - The string to parse.
	 * @returns {NBT.Tag} - The parsed Tag.
	 */
	parse: function(value) {
		return NBT._Parser.parse(value);
	},
	_Parser: {
		/**
		 * Parse the textual representation of an NBT Tag.
		 * @param {string} value - The string to parse.
		 * @returns {NBT.Tag} - The parsed Tag.
		 */
		parse: function(value) {
			this.string = value;
			this.cursor = 0;
			
			var compound = this.readCompound();
			this.skipWhitespace();
			
			if (this.canRead()) {
				++this.cursor;
				throw this.exception("Trailing data found");
			}
			
			return compound;
		},
		canRead: function() {
			return this.cursor < this.string.length;
		},
		whitespaceRE: /^\s*/,
		skipWhitespace: function() {
			this.cursor += this.string.substr(this.cursor).match(this.whitespaceRE)[0].length;
		},
		hasElementSeparator: function() {
			this.skipWhitespace();
			if (this.canRead() && this.peek() === ",") {
				++this.cursor;
				this.skipWhitespace();
				return true;
			}
			return false;
		},
		expect: function(expected) {
			this.skipWhitespace();
			var canRead = this.canRead();

			if (canRead && this.peek() === expected) {
				++this.cursor;
			} else {
				var message = "Expected '" + expected + "' but got '" +
					(canRead ? this.peek() : "<EOF>") + "'";
				++this.cursor;
				throw this.exception(message);
			}
		},
		peek: function(offset) {
			return this.string[this.cursor + (offset|0)];
		},
		pop: function() {
			return this.string[this.cursor++];
		},
		exception: function(message, suggestion) {
			var end = Math.min(this.string.length, this.cursor),
				exception;
			if (end > 35) {
				exception = "...";
			} else {
				exception = "";
			}
			exception += this.string.substring(Math.max(0, end - 35), end);
			exception += "<--[HERE]";
			exception = message + " at: " + exception;
			if (suggestion) return {error: "parsing_error", message: exception, suggestion: suggestion};
			return {error: "parsing_error", message: exception};
		},
		readCompound: function() {
			this.expect("{");
			var compound = new NBT.TagCompound();
			this.skipWhitespace();
			
			while (this.canRead() && this.peek() != "}") {
				this.skipWhitespace();
				var key;
				if (!this.canRead()) {
					throw this.exception("Expected a key");
				} else {
					key = this.peek() === '"' ? this.readQuotedString() : this.readUnquotedString();
				}
				if (!key) throw this.exception("Expected non-empty key");
				if (key in compound.map) throw this.exception("Duplicate key");
				
				this.expect(":");
				compound.add(key, this.readValue());
				
				if (!this.hasElementSeparator()) break;
				if (!this.canRead()) throw this.exception("Expected a key");
			}
			this.expect("}");
			return compound;
		},
		readValue: function() {
			this.skipWhitespace();
			if (!this.canRead()) throw this.exception("Expected a value");
			var next = this.peek();
			
			switch (next) {
			case "{":
				return this.readCompound();
			case "[":
				return this.peek(1) !== '"' && this.peek(2) === ";" ?
					this.readArrayTag() : this.readListTag();
			case '"':
				return new NBT.TagString(this.readQuotedString(), false);
			}
			var s = this.readUnquotedString(), num;
			if (!s) throw this.exception("Expected a value");
			try {
				num = this.parseNumber(s);
			} catch (e) {
				s = new NBT.TagString(s, false);
				s.limitErr = e;
				return s;
			}
			return num || new NBT.TagString(s, false);
		},
		readArrayTag: function() {
			this.expect("[");
			var type = this.pop(), array;
			this.pop();
			this.skipWhitespace();
			
			if (!this.canRead()) throw this.exception("Expected a value");
			switch (type) {
			case "B":
				array = new NBT.TagArrayByte();
				break;
			case "L":
				array = new NBT.TagArrayLong();
				break;
			case "I":
				array = new NBT.TagArrayInt();
				break;
			default:
				throw this.exception("Invalid array type '" + type + "' found");
			}
			
			while (true) {
				if (this.peek() === "]") {
					++this.cursor;
					return array;
				}
				
				var currValue = this.readValue();
				if (currValue.constructor !== array.type) {
					throw this.exception("Unable to insert " + currValue.tagName +
						" into " + array.tagName);
				}
				array.push(currValue);
				if (this.hasElementSeparator()) {
					if (!this.canRead()) throw this.exception("Expected a value");
					continue;
				}
				
				this.expect("]");
				return array;
			}
		},
		readListTag: function() {
			this.expect("[");
			this.skipWhitespace();
			
			if (!this.canRead()) {
				throw this.exception("Expected a value");
			} else {
				var list = new NBT.TagList();
				
				while (this.peek() !== "]") {
					var val = this.readValue();
					try {	
						list.push(val);
					} catch (e) {
						throw this.exception("Unable to insert " + val.tagName +
							" into ListTag of type " + list.type.prototype.tagName);
					}
					if (!this.hasElementSeparator()) break;
					if (!this.canRead()) throw this.exception("Expected a value");
				}
				
				this.expect("]");
				return list;
			}
		},
		unquotedCharsRE: /^[a-zA-Z0-9._+\-]*/,
		readUnquotedString: function() {
			var string = this.string.substr(this.cursor).match(this.unquotedCharsRE)[0];
			this.cursor += string.length;
			return string;
		},
		readQuotedString: function() {
			var startChunkIndex = ++this.cursor,
				string = "",
				inEscape = false;
			while (this.canRead()) {
				var c = this.pop();
				if (inEscape) {
					if (c !== "\\" && c !== '"') throw this.exception("Invalid escape of '" + c + "'");
					string += c;
					startChunkIndex = this.cursor;
					inEscape = false;
				} else if (c === "\\") {
					inEscape = true;
					string += this.string.substring(startChunkIndex, this.cursor - 1);
				} else if (c == '"') {
					return string + this.string.substring(startChunkIndex, this.cursor - 1);
				}
			}
			throw this.exception("Missing termination quote");
		},
		doubleNoSufRE: /^[-+]?(?:[0-9]+\.|[0-9]*\.[0-9]+)(?:e[-+]?[0-9]+)?$/i,
		doubleRE:      /^[-+]?(?:[0-9]+\.?|[0-9]*\.[0-9]+)(?:e[-+]?[0-9]+)?d$/i,
		floatRE:       /^[-+]?(?:[0-9]+\.?|[0-9]*\.[0-9]+)(?:e[-+]?[0-9]+)?f$/i,
		byteRE:        /^[-+]?(?:0|[1-9][0-9]*)b$/i,
		shortRE:       /^[-+]?(?:0|[1-9][0-9]*)s$/i,
		integerRE:     /^[-+]?(?:0|[1-9][0-9]*)$/,
		longRE:        /^([-+])?(?:0|[1-9][0-9]*)l$/i,
		parseNumber: function(s) {
			if (this.floatRE.test(s)) {
				return new NBT.TagFloat(+s.substr(0, s.length - 1));
			}
			if (this.byteRE.test(s)) {
				return new NBT.TagByte(+s.substring(0, s.length - 1));
			}
			if (this.longRE.test(s)) {
				// As a string
				return new NBT.TagLong(s.substring(0, s.length - 1));
			}
			if (this.shortRE.test(s)) {
				return new NBT.TagShort(+s.substring(0, s.length - 1));
			}
			if (this.integerRE.test(s)) {
				return new NBT.TagInteger(+s);
			}
			if (this.doubleRE.test(s)) {
				return new NBT.TagDouble(+s.substring(0, s.length - 1));
			}
			if (this.doubleNoSufRE.test(s)) {
				return new NBT.TagDouble(+s);
			}
			if (s.toLowerCase() === "true") {
				return new NBT.TagByte(1);
			}
			if (s.toLowerCase() === "false") {
				return new NBT.TagByte(0);
			}
		}
	},
};
NBT.TagByte.prototype    = Object.create(NBT.TagNumber.prototype);
NBT.TagShort.prototype   = Object.create(NBT.TagNumber.prototype);
NBT.TagInteger.prototype = Object.create(NBT.TagNumber.prototype);
NBT.TagLong.prototype    = Object.create(NBT.TagNumber.prototype);
NBT.TagFloat.prototype   = Object.create(NBT.TagNumber.prototype);
NBT.TagDouble.prototype  = Object.create(NBT.TagNumber.prototype);
NBT.TagByte.prototype.constructor    = NBT.TagByte;
NBT.TagShort.prototype.constructor   = NBT.TagShort;
NBT.TagInteger.prototype.constructor = NBT.TagInteger;
NBT.TagLong.prototype.constructor    = NBT.TagLong;
NBT.TagFloat.prototype.constructor   = NBT.TagFloat;
NBT.TagDouble.prototype.constructor  = NBT.TagDouble;
NBT.TagByte.prototype.suffix    = "b";
NBT.TagShort.prototype.suffix   = "s";
NBT.TagInteger.prototype.suffix = "";
NBT.TagLong.prototype.suffix    = "l";
NBT.TagFloat.prototype.suffix   = "f";
NBT.TagDouble.prototype.suffix  = "d";
NBT.TagList.prototype.arrayPrefix      = "";
NBT.TagArrayByte.prototype.arrayPrefix = "B;";
NBT.TagArrayInt.prototype.arrayPrefix  = "I;";
NBT.TagArrayLong.prototype.arrayPrefix = "L;";
NBT.TagByte.prototype.minValue    = -128
NBT.TagByte.prototype.maxValue    =  127
NBT.TagShort.prototype.minValue   = -32768
NBT.TagShort.prototype.maxValue   =  32767
NBT.TagInteger.prototype.minValue = -2147483648
NBT.TagInteger.prototype.maxValue =  2147483647
NBT.TagLong.prototype.minValue    ="-9223372036854775808"
NBT.TagLong.prototype.maxValue    = "9223372036854775807"
NBT.TagLong.prototype.minValueSignless = "9223372036854775808"
if (typeof ArrayBuffer !== "undefined" && typeof Float32Array !== "undefined" && typeof Int32Array !== "undefined") {
	// Calculate max float32 value accurately
	var buf = new ArrayBuffer(4),
		f32 = new Float32Array(buf),
		i32 = new Int32Array(buf);
	i32[0] = 0x7f7fffff;
	NBT.TagFloat.prototype.minValue = -f32[0];
	NBT.TagFloat.prototype.maxValue =  f32[0];
} else {
	NBT.TagFloat.prototype.minValue = -3.4028234663852886e+38;
	NBT.TagFloat.prototype.maxValue =  3.4028234663852886e+38;
}
NBT.TagDouble.prototype.minValue  = -Number.MAX_VALUE;
NBT.TagDouble.prototype.maxValue  =  Number.MAX_VALUE;
NBT.TagArrayByte.prototype = Object.create(NBT.TagList.prototype);
NBT.TagArrayInt.prototype  = Object.create(NBT.TagList.prototype);
NBT.TagArrayLong.prototype = Object.create(NBT.TagList.prototype);
NBT.TagArrayByte.prototype.constructor = NBT.TagArrayByte;
NBT.TagArrayInt.prototype.constructor  = NBT.TagArrayInt;
NBT.TagArrayLong.prototype.constructor = NBT.TagArrayLong;
NBT.TagByte.prototype.tagName      = "TAG_Byte";
NBT.TagShort.prototype.tagName     = "TAG_Short";
NBT.TagInteger.prototype.tagName   = "TAG_Int";
NBT.TagLong.prototype.tagName      = "TAG_Long";
NBT.TagFloat.prototype.tagName     = "TAG_Float";
NBT.TagDouble.prototype.tagName    = "TAG_Double";
NBT.TagString.prototype.tagName    = "TAG_String";
NBT.TagList.prototype.tagName      = "TAG_List";
NBT.TagCompound.prototype.tagName  = "TAG_Compound";
NBT.TagArrayByte.prototype.tagName = "TAG_Byte_Array";
NBT.TagArrayInt.prototype.tagName  = "TAG_Int_Array";
NBT.TagArrayLong.prototype.tagName = "TAG_Long_Array";
NBT.TagString.prototype.sortOrder    =  0;
NBT.TagByte.prototype.sortOrder      =  1;
NBT.TagShort.prototype.sortOrder     =  2;
NBT.TagInteger.prototype.sortOrder   =  3;
NBT.TagLong.prototype.sortOrder      =  4;
NBT.TagFloat.prototype.sortOrder     =  5;
NBT.TagDouble.prototype.sortOrder    =  6;
NBT.TagCompound.prototype.sortOrder  =  7;
NBT.TagArrayByte.prototype.sortOrder =  8;
NBT.TagArrayInt.prototype.sortOrder  =  9;
NBT.TagArrayLong.prototype.sortOrder = 10;
NBT.TagList.prototype.sortOrder      = 11;

/**
 * Add a Tag to a Compound.
 * @param {string} key - The key of the new Tag.
 * @param {NBT.Tag} value - The Tag to add.
 */
NBT.TagCompound.prototype.add = function(key, value) {
	if (key in this.map) {
		throw {error: "duplicate_key", message: "Duplicate key: " + NBT._printString(new NBT.TagString(key, true), {})};
	}
	this.pairs.push([new NBT.TagString(key, true), value]);
	this.map[key] = value;
};
/**
 * Add a Tag to the end of a List.
 * @param {NBT.Tag} value - The Tag to add.
 */
NBT.TagList.prototype.push = function(value) {
	this.type = this.type || value.constructor;
	if (value.constructor !== this.type) {
		// TODO: Explain how type is determined, suggest fix
		throw {error: "invalid_tag_type", message: "Cannot insert " + value.constructor.name
			+ " into a list of type " + this.type.name};
	}
	this.list.push(value);
};
