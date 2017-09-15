var NBT = {
	quotedCharRE: /[^a-zA-Z0-9._+\-]/,
	TagString: function(value, needQuotes) {
		this.value = value;
	},
	TagNumber: function(value, suffix) {
		this.value = value;
		this.suffix = suffix;
	},
	TagByte: function(value) {
		NBT.TagNumber.call(this, value, "b");
	},
	TagShort: function(value) {
		NBT.TagNumber.call(this, value, "s");
	},
	TagInteger: function(value) {
		NBT.TagNumber.call(this, value, "");
	},
	TagLong: function(value) {
		NBT.TagNumber.call(this, value, "l");
	},
	TagFloat: function(value) {
		NBT.TagNumber.call(this, value, "f");
	},
	TagDouble: function(value) {
		NBT.TagNumber.call(this, value, "d");
	},
	TagCompound: function() {
		this.pairs = [];
		this.map = {};
	},
	TagList: function(type, arrayPrefix) {
		this.type = type;
		this.arrayPrefix = arrayPrefix || "";
		this.list = [];
	},
	TagArrayByte: function() {
		NBT.TagList.call(this, NBT.TagByte, "B;");
	},
	TagArrayInt: function() {
		NBT.TagList.call(this, NBT.TagInteger, "I;");
	},
	TagArrayLong: function() {
		NBT.TagList.call(this, NBT.TagLong, "L;");
	},
	stringify: function(value, space, options) {
		if (space == null) space = "\t";
		options = options || {};
		options.capitalizeSuffix = options.capitalizeSuffix || {};
		return NBT._printValue(value, space, "", options);
	},
	_printValue: function(value, space, indent, options) {
		switch (value.constructor) {
		case NBT.TagString:
			return NBT._printString(value.value, false, options);
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
	_printString: function(str, isKey, options) {
		if ((isKey ? options.quoteKeys : !options.unquoteStrings)
				|| NBT.quotedCharRE.test(str)) {
			return '"' + str
				.replace(/\\/g, '\\\\')
				.replace(/"/g, '\\"') + '"';
		}
		return str;
	},
	_printNumber: function(number, options) {
		var cap = options.capitalizeSuffix[number.suffix];
		if (cap == null) cap = options.capitalizeSuffix["default"];
		return number.value + (cap ? number.suffix.toUpperCase() : number.suffix);
	},
	compareAlpha: function(a, b) {
		var nameA = a[0], nameAI = nameA.toLowerCase(),
				nameB = b[0], nameBI = nameB.toLowerCase();
		if (nameAI < nameBI) return -1;
		if (nameAI > nameBI) return  1;
		if (nameA < nameB) return -1;
		if (nameA > nameB) return  1;
		return 0;
	},
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
	compareTypeAlpha: function(a, b) {
		return NBT.compareType(a, b) || NBT.compareAlpha(a, b);
	},
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
			str += NBT._printString(list[i][0], true, options) + (options.deflate ? ":" : ": ");
			str += NBT._printValue(list[i][1], space, indent, options);
			str += options.deflate ? "," : ",\n";
		}
		if (!options.deflate) str += indent;
		str += NBT._printString(list[i][0], true, options) + (options.deflate ? ":" : ": ");
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
	parse: function(value) {
		return NBT._Parser.parse(value);
	},
	_Parser: {
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
			if (suggestion) return {error: exception, suggestion: suggestion};
			return {error: exception};
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
				return new NBT.TagString(this.readQuotedString());
			}
			var s = this.readUnquotedString(), num;
			if (!s) throw this.exception("Expected a value");
			try {
				num = this.parseNumber(s);
			} catch (e) {
				s = new NBT.TagString(s);
				s.limitErr = e;
				return s;
			}
			return num || new NBT.TagString(s);
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
				array.add(currValue);
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
						list.add(val);
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
		longRE:        /^([-+])?(0|[1-9][0-9]*)l$/i,
		parseNumber: function(s) {
			if (this.floatRE.test(s)) {
				var val = s.substr(0, s.length - 1),
					parsed = +val;
				if ("maxFloat32" in this) {
					if (parsed < -this.maxFloat32) {
						return new NBT.TagFloat("-9e99");
					} else if (parsed > this.maxFloat32) {
						return new NBT.TagFloat("9e99");
					}
				}
				if (+(parsed.toString()) != parsed) return new NBT.TagFloat(val);
				return new NBT.TagFloat(parsed);
			}
			if (this.byteRE.test(s)) {
				var parsed = +s.substring(0, s.length - 1);
				if (parsed >  127) throw {type: NBT.TagByte, max:  "127"};
				if (parsed < -128) throw {type: NBT.TagByte, min: "-128"};
				return new NBT.TagByte(parsed);
			}
			var longParts = this.longRE.exec(s);
			if (longParts) {
				// Work around JS's lack of longs
				var sign = longParts[1],
					digits = longParts[2];
				if (digits === "0") return new NBT.TagLong(0);
				if (digits.length > 19) throw {type: NBT.TagLong, max: "9223372036854775807"};
				if (digits.length < 19) {
					if (sign === "-") return new NBT.TagLong(sign + digits);
					return new NBT.TagLong(digits);
				}
				
				var limit = (sign === "-") ? "9223372036854775808" : "9223372036854775807";
				for (var i = 0; i < limit.length; ++i) {
					if (digits[i] !== limit[i]) {
						if (digits[i] < limit[i]) break;
						if (sign === "-") throw {type: NBT.TagLong, min: "-9223372036854775808"};
						throw {type: NBT.TagLong, max: "9223372036854775807"};
					}
				}
				
				if (sign === "-") return new NBT.TagLong(sign + digits);
				return new NBT.TagLong(digits);
			}
			if (this.shortRE.test(s)) {
				var parsed = +s.substring(0, s.length - 1);
				if (parsed >  32767) throw {type: NBT.TagShort, max:  "32767"};
				if (parsed < -32768) throw {type: NBT.TagShort, min: "-32768"};
				return new NBT.TagShort(parsed);
			}
			if (this.integerRE.test(s)) {
				var parsed = +s;
				if (parsed >  2147483647) throw {type: NBT.TagInteger, max:  "2147483647"};
				if (parsed < -2147483648) throw {type: NBT.TagInteger, max: "-2147483648"};
				return new NBT.TagInteger(parsed);
			}
			if (this.doubleRE.test(s) || this.doubleNoSufRE.test(s)) {
				var val = (s[s.length - 1].toLowerCase() === "d") ? s.substr(0, s.length - 1) : s,
					parsed = +val;
				if (parsed <= Number.NEGATIVE_INFINITY) {
					return new NBT.TagDouble("-9e999");
				} else if (parsed >= Number.POSITIVE_INFINITY) {
					return new NBT.TagDouble("9e999");
				}
				if (+(parsed.toString()) != parsed) return new NBT.TagDouble(val);
				return new NBT.TagDouble(parsed);
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
if (typeof ArrayBuffer !== "undefined" && typeof Float32Array !== "undefined" && typeof Int32Array !== "undefined") {
	// Calculate max float32 value accurately
	var buf = new ArrayBuffer(4),
		f32 = new Float32Array(buf),
		i32 = new Int32Array(buf);
	i32[0] = 0x7f7fffff;
	NBT._Parser.maxFloat32 = f32[0];
}
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

NBT.TagCompound.prototype.add = function(key, value) {
	if (key in this.map) {
		throw "Duplicate key: " + NBT._printString(key, true);
	}
	this.pairs.push([key, value]);
	this.map[key] = value;
};
NBT.TagList.prototype.add = function(value) {
	this.type = this.type || value.constructor;
	if (value.constructor !== this.type) {
		// TODO: Explain how type is determined, suggest fix
		throw "Cannot insert " + value.constructor.name
			+ " into a list of type " + this.type.name;
	}
	this.list.push(value);
};
