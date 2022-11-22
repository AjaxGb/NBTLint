/*!
 * "nbt-lint" NBT Text Library v2.0.0 | MIT License
 * https://github.com/AjaxGb/NBTLint
 */

function getTypeName(value) {
	if (value === null) return 'null';
	const typeofName = typeof value;
	if (typeofName !== 'object') return typeofName;
	if (Symbol.toStringTag in value) return value[Symbol.toStringTag];
	return value.constructor.name;
}
	
function memoize(map, tag, fn) {
	const memoized = map.get(tag);
	if (memoized !== undefined) return memoized;
	const newValue = fn();
	map.set(tag, newValue);
	return newValue;
}

export class RangeError extends Error {
	constructor({value, origValue, tagType}) {
		const coercedMessage = Object.is(value, origValue) ? '' : ` (coerced from ${origValue})`;
		super(
			`Value ${value}${coercedMessage} is out of range for a ${tagType.name} `
			+ `(min: ${tagType.MIN_VALUE}, max: ${tagType.MAX_VALUE})`);
		this.error = 'out_of_range';
		this.attrs = {value, origValue, tagType};
	}
}

export class DuplicateKeyError extends Error {
	constructor(key) {
		super(`Attempted to insert duplicate key ${TagString.valueToSNBT(key)} into compound`);
		this.error = 'duplicate_key';
		this.attrs = {key};
	}
}

export class KeyTypeError extends Error {
	constructor(key) {
		const typeName = (key === null) ? 'null' : 
		super(`Compound keys must be strings, but ${key} is of type ${getTypeName(key)}`);
		this.error = 'wrong_key_type';
		this.attrs = {key};
	}
}

export class ValueTypeError extends TypeError {
	constructor({value, type}) {
		super(`The value ${value} is of type ${getTypeName(value)}, not an instance of ${type.name}`);
		this.error = 'wrong_value_type';
		this.attrs = {value, type};
	}
}

export class NotATagTypeError extends TypeError {
	constructor(type) {
		super(`The type ${type?.name ?? type} is not a concrete NBT tag type`);
		this.error = 'not_a_tag_type';
		this.attrs = {type};
	}
}

export class TypeAlreadySetError extends TypeError {
	constructor({newType, currType, value=undefined}) {
		const valueMessage = value ? ` (by inserting ${value})` : '';
		super(
			`List's type is already set to ${currType.name}, changing the type to `
			+ `${newType.name}${valueMessage} is not allowed`);
		this.error = 'type_already_set';
		this.attrs = {newType, currType, value};
	}
}

export class TagBase {
	constructor() {
		const type = this.constructor;
		if (!TagBase.isConcreteTagType(type)) {
			throw new Error(
				`${type.name} is an abstract class and cannot be instantiated directly`);
		}
	}
	
	static isConcreteTagType(type) {
		return ALL_TAG_TYPES.has(type);
	}
}

class TagPrimitiveBase extends TagBase {
	static IS_PRIMITIVE = true;
	static IS_LISTLIKE = false;
	
	constructor(value, ...extraProps) {
		super();
		const type = this.constructor;
		this.value = type.coerceType(value ?? type.DEFAULT_VALUE);
		this._init(value, ...extraProps);
		Object.freeze(this);
	}
	
	_init(origValue) {}
	
	toString() {
		return `${this.constructor.name}(${stringify(this)})`;
	}
}

export class TagString extends TagPrimitiveBase {
	static TAG_NAME = 'TAG_String';
	static DEFAULT_VALUE = '';
	
	static QUOTED_CHARS_RE = /[^a-zA-Z0-9._+\-]/;
	
	static coerceType(value) {
		return String(value);
	}
}

class TagNumberBase extends TagPrimitiveBase {
	static DEFAULT_VALUE = 0;
}

class TagIntegerBase extends TagNumberBase {
	_init(origValue) {
		const tagType = this.constructor;
		if (this.value < tagType.MIN_VALUE || this.value > tagType.MAX_VALUE) {
			throw new RangeError({
				value: this.value,
				origValue,
				tagType,
			});
		}
	}
	
	static coerceType(value) {
		return Math.trunc(value);
	}
}

export class TagByte extends TagIntegerBase {
	static TAG_NAME = 'TAG_Byte';
	static NUM_BITS = 8;
	static MIN_VALUE = -128;
	static MAX_VALUE = 127;
	static SUFFIX = 'b';
	
	_init(origValue, {preferBool}={}) {
		super._init(origValue);
		this.preferBool = Boolean(preferBool ?? typeof origValue === 'boolean');
	}
}

export class TagShort extends TagIntegerBase {
	static TAG_NAME = 'TAG_Short';
	static NUM_BITS = 16;
	static MIN_VALUE = -32768;
	static MAX_VALUE = 32767;
	static SUFFIX = 's';
}

export class TagInt extends TagIntegerBase {
	static TAG_NAME = 'TAG_Int';
	static NUM_BITS = 32;
	static MIN_VALUE = -2147483648;
	static MAX_VALUE = 2147483647;
	static SUFFIX = '';
}

export class TagLong extends TagIntegerBase {
	static TAG_NAME = 'TAG_Long';
	static NUM_BITS = 64;
	static DEFAULT_VALUE = 0n;
	static MIN_VALUE = -9223372036854775808n;
	static MAX_VALUE = 9223372036854775807n;
	static SUFFIX = 'l';
	
	static coerceType(value) {
		return BigInt(value);
	}
}

class TagFloatBase extends TagNumberBase {}

export class TagFloat extends TagFloatBase {
	static TAG_NAME = 'TAG_Float';
	static SUFFIX = 'f';
	static INFINITY_ALIAS = '9e99';
	
	static coerceType(value) {
		return Math.fround(value);
	}
}

export class TagDouble extends TagFloatBase {
	static TAG_NAME = 'TAG_Double';
	static SUFFIX = 'd';
	static INFINITY_ALIAS = '9e999';
	
	static coerceType(value) {
		return Number(value);
	}
}

export class TagCompound extends TagBase {
	static TAG_NAME = 'TAG_Compound';
	static IS_PRIMITIVE = false;
	static IS_LISTLIKE = false;
	
	constructor(values=[]) {
		super();
		this.map = new Map();
		Object.freeze(this);
		if (Symbol.iterator in values) {
			for (const [key, value] of values) {
				this.add(key, value);
			}
		} else {
			for (const key in values) {
				this.add(key, values[key]);
			}
		}
	}
	
	get size() {
		return this.map.size;
	}
	
	items() {
		return this.map[Symbol.iterator]();
	}
	
	keys() {
		return this.map.keys();
	}
	
	values() {
		return this.map.values();
	}
	
	add(key, value) {
		if (this.map.has(key)) {
			throw new DuplicateKeyError(key);
		}
		return this.set(key, value);
	}
	
	set(key, value) {
		if (typeof key !== 'string') {
			throw new KeyTypeError(key);
		}
		if (!(value instanceof TagBase)) {
			throw new ValueTypeError({value, type: TagBase});
		}
		this.map.set(key, value);
		return this;
	}
}

class TagListBase extends TagBase {
	static IS_PRIMITIVE = false;
	static IS_LISTLIKE = true;
	
	constructor() {
		super();
		this.values = [];
	}
	
	push(value) {
		const type = this.getListType();
		if (!(value instanceof type)) {
			throw new ValueTypeError({value, type});
		}
		this.values.push(value);
	}
	
	get size() {
		return this.values.length;
	}
	
	get(index) {
		return this.values[index < 0 ? this.values.length + index : index];
	}
	
	[Symbol.iterator]() {
		return this.values[Symbol.iterator]();
	}
}

export class TagList extends TagListBase {
	static TAG_NAME = 'TAG_List';
	
	constructor(type=undefined, values=[]) {
		super();
		this.type = undefined;
		if (type) this.setListType(type);
		for (const value of values) {
			this.push(value);
		}
	}
	
	getListType() {
		return this.type;
	}
	
	setListType(type, fromValue=undefined) {
		if (this.type) {
			throw new TypeAlreadySetError({
				newType: type,
				currType: this.type,
				value: fromValue,
			});
		}
		if (!TagBase.isConcreteTagType(type)) {
			throw new NotATagTypeError(type);
		}
		Object.defineProperty(this, 'type', {
			enumerable: true,
			writable: false,
			value: type,
		});
	}
	
	push(value) {
		if (!this.type) {
			this.setListType(value.constructor, value);
		}
		super.push(value);
	}
}

class TagArrayBase extends TagListBase {
	constructor(values=[]) {
		super();
		for (const value of values) {
			this.push(value);
		}
	}
	
	getListType() {
		return this.constructor.ARRAY_TYPE;
	}
}

export class TagByteArray extends TagArrayBase {
	static TAG_NAME = 'TAG_Byte_Array';
	static ARRAY_TYPE = TagByte;
	static ARRAY_PREFIX = 'B';
}

export class TagIntArray extends TagArrayBase {
	static TAG_NAME = 'TAG_Int_Array';
	static ARRAY_TYPE = TagInt;
	static ARRAY_PREFIX = 'I';
}

export class TagLongArray extends TagArrayBase {
	static TAG_NAME = 'TAG_Long_Array';
	static ARRAY_TYPE = TagLong;
	static ARRAY_PREFIX = 'L';
}

export const ALL_TAG_TYPES = new Set([
	TagByte,
	TagShort,
	TagInt,
	TagLong,
	TagFloat,
	TagDouble,
	TagString,
	TagCompound,
	TagList,
	TagByteArray,
	TagIntArray,
	TagLongArray,
]);

// Initialize DISPLAY_TAG_ORDER
const DISPLAY_TAG_ORDER = [
	TagString,
	TagByte,
	TagShort,
	TagInt,
	TagLong,
	TagFloat,
	TagDouble,
	TagCompound,
	TagByteArray,
	TagIntArray,
	TagLongArray,
	TagList,
];
const DISPLAY_TAG_ORDER_SYMBOL = Symbol('DISPLAY_TAG_ORDER');
for (let i = 0; i < DISPLAY_TAG_ORDER.length; i++) {
	DISPLAY_TAG_ORDER[i][DISPLAY_TAG_ORDER_SYMBOL] = i;
}

export function stringify(tag) {
	return Stringifier.DEFAULT.stringify(tag);
}

/**
 * Sort functions suitable for passing to {@link Stringify.compoundSort}.
 */
export const Sort = {
	/**
	 * Compare two key-value compound member pairs alphabetically.
	 * @param {[string, TagBase]} a - The first key-value pair.
	 * @param {[string, TagBase]} b - The second key-value pair.
	 * @returns {number} - The result of the comparison.
	 */
	alphabetically: ([nameA, tagA], [nameB, tagB]) => {
		const nameAI = nameA.toLowerCase();
		const nameBI = nameB.toLowerCase();
		if (nameAI < nameBI) return -1;
		if (nameAI > nameBI) return 1;
		if (nameA < nameB) return -1;
		if (nameA > nameB) return 1;
		return 0;
	},
	/**
	 * Compare two key-value compound member pairs by their types.
	 * @param {[string, TagBase]} a - The first key-value pair.
	 * @param {[string, TagBase]} b - The second key-value pair.
	 * @returns {number} - The result of the comparison.
	 */
	byType: ([nameA, tagA], [nameB, tagB]) => {
		const orderA = tagA.constructor[DISPLAY_TAG_ORDER_SYMBOL];
		const orderB = tagA.constructor[DISPLAY_TAG_ORDER_SYMBOL];
		if (orderA < orderB) return -1;
		if (orderA > orderB) return  1;
		if (tagA.constructor !== TagList) return 0;
		const listOrderA = tagA.type?.[DISPLAY_TAG_ORDER_SYMBOL] ?? -1;
		const listOrderB = tagB.type?.[DISPLAY_TAG_ORDER_SYMBOL] ?? -1;
		if (listOrderA < listOrderB) return -1;
		if (listOrderA > listOrderB) return  1;
		return 0;
	},
	/**
	 * Compare two key-value compound member pairs, first by their types, then alphabetically.
	 * @param {[string, TagBase]} a - The first key-value pair.
	 * @param {[string, TagBase]} b - The second key-value pair.
	 * @returns {number} - The result of the comparison.
	 */
	byTypeAndAlphabetically: (a, b) => {
		return Sort.byType(a, b) || Sort.alphabetically(a, b);
	},
};

function enforceStringEnum(name, value, variants) {
	const valueStr = String(value);
	if (!variants.includes(valueStr)) {
		throw new Error(`${name} must be set to null or one of ${JSON.stringify(variants)}, not to ${valueStr}`);
	}
	return valueStr;
}

/**
 * A string enum representing the preferred SNBT quote type
 * @typedef {'onlyDouble'|'preferDouble'|'preferSingle'|'onlySingle'} QuotePreference
 */

/**
 * A string enum representing when to display bytes as bools in SNBT
 * @typedef {'always'|'never'|'preserve'} BoolPreference
 */

/**
 * Used to set {@link Stringifier.capitalizeSuffix}. One of:
 * - A string containing all capitalized suffixes.
 * - True or false, setting all suffixes to capitalized or uncapitalized, respectively.
 * - An object that can contain boolean properties for each suffix, and a 'default' boolean
 *   property to set unspecified suffixes.
 * @typedef {Object|string|boolean} CapitalizeSuffixInput
 */

/**
 * Class for turning NBT tags into SNBT strings.
 */
export class Stringifier {
	/**
	 * Create a Stringifier.
	 * @param {Object}   [opt] Customize this Stringifier's output.
	 * @param {boolean}  [opt.deflate=false]                  Avoid all whitespace, collapsing output onto one line.
	 * @param {string}   [opt.indent='\t']                    The string to use for indentation.
	 * @param {boolean}  [opt.bracketsOwnLine=false]          Put brackets on their own line after compound keys.
	 * @param {boolean}  [opt.collapseAdjacentBrackets=false] Collapse adjacent brackets to the same line.
	 * @param {number}   [opt.collapsePrimitiveLists=true]    A list of simple single-line items will also be single-line.
	 * @param {boolean}  [opt.trailingComma=false]            Add a trailing comma at the ends of collections.
	 * @param {Function} [opt.compoundSort=null]              A sorting function to use on compound key-value pairs.
	 *                                                        Recommended: the functions in {@link Sort}.
	 * @param {boolean}  [opt.alwaysQuoteKeys=false]          Force all keys to be quoted.
	 * @param {boolean}  [opt.alwaysQuoteStrings=true]        Force all non-key strings to be quoted.
	 * @param {QuotePreference} [opt.quotePreference='preferDouble'] How to choose between single and double quotes.
	 * @param {BoolPreference} [opt.bytesAsBools='preserve']  How to choose between boolean and numeric bytes.
	 * @param {CapitalizeSuffixInput} [opt.capitalizeSuffix='l'] Which number suffixes to capitalize.
	 */
	constructor({
		deflate=false,
		indent='\t',
		bracketsOwnLine=false,
		collapseAdjacentBrackets=false,
		collapsePrimitiveLists=true,
		trailingComma=false,
		compoundSort=null,
		alwaysQuoteKeys=false,
		alwaysQuoteStrings=true,
		quotePreference='preferDouble',
		bytesAsBools='preserve',
		capitalizeSuffix='l',
	}={}) {
		this._opt = Object.create(null);
		this._opt.capitalizeSuffix = Object.create(null);
		for (const suffix of 'bslfd') {
			this._opt.capitalizeSuffix[suffix] = false;
		}
		Object.seal(this._opt.capitalizeSuffix);
		
		this.deflate = deflate;
		this.indent = indent;
		this.bracketsOwnLine = bracketsOwnLine;
		this.collapseAdjacentBrackets = collapseAdjacentBrackets;
		this.collapsePrimitiveLists = collapsePrimitiveLists;
		this.trailingComma = trailingComma;
		this.compoundSort = compoundSort;
		this.alwaysQuoteKeys = alwaysQuoteKeys;
		this.alwaysQuoteStrings = alwaysQuoteStrings;
		this.quotePreference = quotePreference;
		this.bytesAsBools = bytesAsBools;
		this.capitalizeSuffix = capitalizeSuffix;
		
		Object.seal(this);
	}
	
	/// Stringify methods
	
	stringify(tag) {
		const parts = [];
		const textOnly = (text, type) => text;
		for (const span of this._value(tag, textOnly)) {
			parts.push(span);
		}
		return parts.join('');
	}
	
	*stringifyToSpans(tag) {
		let lineNum = 1;
		let colNum = 1;
		
		const spanMaker = (text, type) => {
			const span = new Span(text, type, lineNum, colNum);
			const lines = text.split('\n');
			if (lines.length > 1) {
				lineNum += lines.length - 1;
				colNum = lines[lines.length - 1].length + 1;
			}
			return span;
		};
		
		yield* this._value(tag, spanMaker);
	}
	
	/// Option accessors
	
	/**
	 * @param {boolean} value Avoid all whitespace, collapsing output onto one line.
	 */
	set deflate(v) { this._opt.deflate = Boolean(v); }
	/**
	 * @return {boolean} Avoid all whitespace, collapsing output onto one line.
	 */
	get deflate() { return this._opt.deflate; }
	
	/**
	 * @param {string} value The string to use for indentation.
	 */
	set indent(v) {
		if (typeof v === 'number') {
			this._opt.indent = ''.padEnd(v);
		} else {
			this._opt.indent = String(v ?? '');
		}
	}
	/**
	 * @return {string} The string to use for indentation.
	 */
	get indent() { return this._opt.indent; }
	
	/**
	 * @param {boolean} value Put brackets on their own line, instead of keeping them on the same line as the key.
	 */
	set bracketsOwnLine(v) { this._opt.bracketsOwnLine = Boolean(v); }
	/**
	 * @return {boolean} Put brackets on their own line, instead of keeping them on the same line as the key.
	 */
	get bracketsOwnLine() { return this._opt.bracketsOwnLine; }
	
	/**
	 * @param {boolean} value Collapse adjacent brackets to the same line.
	 */
	set collapseAdjacentBrackets(v) { this._opt.collapseAdjacentBrackets = Boolean(v); }
	/**
	 * @return {boolean} Collapse adjacent brackets to the same line.
	 */
	get collapseAdjacentBrackets() { return this._opt.collapseAdjacentBrackets; }
	
	/**
	 * @param {boolean} value A list of simple single-line items will also be single-line.
	 */
	set collapsePrimitiveLists(v) { this._opt.collapsePrimitiveLists = Boolean(v); }
	/**
	 * @return {boolean} A list of simple single-line items will also be single-line.
	 */
	get collapsePrimitiveLists() { return this._opt.collapsePrimitiveLists; }
	
	set trailingComma(v) { this._opt.trailingComma = Boolean(v); }
	get trailingComma() { return this._opt.trailingComma; }
	
	set compoundSort(v) {
		if (!v) {
			this._opt.compoundSort = null;
		} else if (typeof v === 'function') {
			this._opt.compoundSort = v;
		} else {
			throw new Error("Stringify's compoundSort option must be set to null or a function (see Sort)");
		}
	}
	get compoundSort() { return this._opt.compoundSort; }
	
	set alwaysQuoteKeys(v) { this._opt.alwaysQuoteKeys = Boolean(v); }
	get alwaysQuoteKeys() { return this._opt.alwaysQuoteKeys; }
	
	set alwaysQuoteStrings(v) { this._opt.alwaysQuoteStrings = Boolean(v); }
	get alwaysQuoteStrings() { return this._opt.alwaysQuoteStrings; }
	
	set quotePreference(v) {
		this._opt.quotePreference = enforceStringEnum("Stringify's quotePreference option",
			v, ['onlyDouble', 'preferDouble', 'preferSingle', 'onlySingle']);
	}
	get quotePreference() { return this._opt.quotePreference; }
	
	set bytesAsBools(v) {
		this._opt.bytesAsBools = enforceStringEnum("Stringify's bytesAsBools option",
			v, ['always', 'never', 'preserve']);
	}
	get bytesAsBools() { return this._opt.bytesAsBools; }
	
	set capitalizeSuffix(v) {
		const obj = this._opt.capitalizeSuffix;
		if (typeof v === 'boolean') {
			for (const suffix in obj) {
				obj[suffix] = v;
			}
		} else if (typeof v === 'string') {
			for (const suffix in obj) {
				obj[suffix] = v.indexOf(suffix) >= 0;
			}
		} else {
			for (const suffix in obj) {
				obj[suffix] = Boolean(v[suffix] ?? v.default);
			}
		}
	}
	get capitalizeSuffix() { return this._opt.capitalizeSuffix; }
	
	/// Object management methods
	
	/**
	 * Deep-freezes this Stringifier, preventing its options from being changed. See {@link Object.freeze}.
	 * @returns {Stringifier} This Stringifier.
	 */
	freeze() {
		Object.freeze(this._opt.capitalizeSuffix);
		Object.freeze(this._opt);
		return Object.freeze(this);
	}
	
	/**
	 * Deep clones this Stringifier.
	 * @returns {Stringifier} A new, modifiable Stringifier with the same options as this one.
	 */
	clone() {
		return new Stringifier(this);
	}
	
	/// Internal stringify methods
	
	*_value(tag, span, currIndent='\n', oneLineMemoizer=new Map()) {
		const type = tag.constructor;
		switch (type) {
		case TagString:
			yield* this._string(tag.value, span);
			break;
		case TagByte:
			yield* this._byte(tag, span);
			break;
		case TagShort:
		case TagInt:
		case TagLong:
			yield* this._integer(tag, span);
			break;
		case TagFloat:
		case TagDouble:
			yield* this._float(tag, span);
			break;
		case TagCompound:
			yield* this._compound(tag, span, currIndent, oneLineMemoizer);
			break;
		case TagList:
		case TagByteArray:
		case TagIntArray:
		case TagLongArray:
			yield* this._list(tag, span, currIndent, oneLineMemoizer);
			break;
		default:
			throw new ValueTypeError({value: tag, type: TagBase});
		}
	}
	
	_getQuote(str) {
		const quotePref = this.quotePreference;
		if (quotePref === 'onlyDouble') return '"';
		if (quotePref === 'onlySingle') return "'";
		const compare = str.split('"').length - str.split("'").length;
		// More " -> positive, more ' -> negative, equal -> 0.
		if (compare > 0) return "'";
		if (compare < 0) return '"';
		return (quotePref === 'preferSingle') ? "'" : '"';
	}
	
	*_string(str, isKey, span) {
		const forceQuotes = isKey ? this.alwaysQuoteKeys : this.alwaysQuoteStrings;
		if (forceQuotes || TagString.QUOTED_CHARS_RE.test(str)) {
			const quote = this._getQuote(str);
			yield span(quote, 'quote');
			const regex = RegExp(`([\n${quote}])|[^\n${quote}]+`, 'g');
			for (const [part, escape] of str.matchAll(regex)) {
				if (escape) {
					yield span('\\' + part, 'escape');
				} else {
					yield span(part, 'string');
				}
			}
			yield span(quote, 'quote');
		} else {
			yield span(str, 'string');
		}
	}
	
	_getPreferBool(tag) {
		switch (this.bytesAsBools) {
			case 'always': return true;
			case 'never': return false;
			default: return tag.preferBool;
		}
	}
	
	*_byte(tag, span) {
		const isBoolable = tag.value === 0 || tag.value === 1;
		if (isBoolable && this._getPreferBool(tag)) {
			yield span(tag.value ? 'true' : 'false', 'boolean');
		} else {
			yield* this._integer(tag, span);
		}
	}
	
	_capitalizeSuffix(suffix) {
		return this.capitalizeSuffix[suffix] ? suffix.toUpperCase() : suffix;
	}
	
	*_integer(tag, span) {
		let value = tag.value;
		if (value < 0) {
			yield span('-', 'sign');
			value = -value;
		}
		yield span(String(value), 'number');
		const suffix = tag.constructor.SUFFIX;
		if (suffix) {
			yield span(this._capitalizeSuffix(suffix), 'suffix');
		}
	}
	
	*_float(tag, span) {
		const type = tag.constructor;
		let value = tag.value;
		if (value < 0 || Object.is(value, -0)) {
			yield span('-', 'sign');
			value = -value;
		}
		if (value === Infinity) {
			yield span(type.INFINITY_ALIAS, 'number');
		} else {
			yield span(String(value), 'number');
		}
		yield span(this._capitalizeSuffix(type.SUFFIX), 'suffix');
	}
	
	_listIsOneLine(list, oneLineMemoizer) {
		return memoize(oneLineMemoizer, list, () => {
			const itemType = list.getListType();
			if (!itemType || itemType.IS_PRIMITIVE) {
				return true;
			} else if (itemType === TagCompound) {
				for (const item of list) {
					if (item.size > 0) return false;
				}
				return true;
			} else { // List of lists
				if (!this.collapsePrimitiveLists) return false;
				for (const item of list) {
					if (item.size > 1) return false;
					if (!this._listIsOneLine(item, oneLineMemoizer)) return false;
				}
				return true;
			}
		});
	}
	
	_isOneLine(tag, oneLineMemoizer) {
		const type = tag.constructor;
		if (type.IS_PRIMITIVE) {
			return true;
		} else if (type === TagCompound) {
			return tag.size === 0;
		} else {
			return this._listIsOneLine(tag, oneLineMemoizer);
		}
	}
	
	_sortedItems(compound) {
		if (this.compoundSort) {
			const items = [...compound.items()];
			items.sort(this.compoundSort);
			return items[Symbol.iterator]();
		} else {
			return compound.items();
		}
	}
	
	*_compound(tag, span, currIndent, oneLineMemoizer) {
		yield span('{', 'brace');
		if (tag.size === 0) {
			yield span('}', 'brace');
			return;
		}
		
		const innerIndent = currIndent + this.indent;
		
		let isFirst = true;
		for (const [key, value] of this._sortedItems(tag)) {
			if (!isFirst) yield span(',', 'separator');
			isFirst = false;
			
			if (!this.deflate) yield span(innerIndent, 'space');
			
			yield* this._string(key, true, span);
			yield span(':', 'separator');
			if (!this.deflate) {
				if (this.bracketsOwnLine && !this._isOneLine(value, oneLineMemoizer)) {
					yield span(innerIndent, 'space');
				} else {
					yield span(' ', 'space');
				}
			}
			
			yield* this._value(value, span, innerIndent, oneLineMemoizer);
		}
		
		if (!this.deflate) {
			if (this.trailingComma) yield span(',', 'separator');
			yield span(currIndent, 'space');
		}
		yield span('}', 'brace');
	}
	
	*_list(tag, span, currIndent, oneLineMemoizer) {
		yield span('[', 'brace');
		
		const isEmpty = tag.size === 0;
		const oneLine = this.deflate || this._listIsOneLine(tag, oneLineMemoizer);
		
		const prefix = tag.constructor.ARRAY_PREFIX;
		if (prefix) {
			yield span(prefix, 'prefix');
			yield span(';', 'separator');
			if (oneLine && !isEmpty && !this.deflate) {
				yield span(' ', 'space');
			}
		}
		
		if (isEmpty) {
			yield span(']', 'brace');
			return;
		}
		
		const collapseFirstLast = oneLine || (this.collapseAdjacentBrackets
			&& !tag.getListType().IS_PRIMITIVE
			&& !(
				this._isOneLine(tag.get(0), oneLineMemoizer) ||
				this._isOneLine(tag.get(-1), oneLineMemoizer)
			)
		);
		const innerIndent = oneLine ? ' ' : collapseFirstLast ? currIndent : currIndent + this.indent;
		
		let isFirst = true;
		for (const item of tag) {
			if (!isFirst) yield span(',', 'separator');
			if (!(isFirst && collapseFirstLast) && !this.deflate) {
				yield span(innerIndent, 'space');
			}
			isFirst = false;
			
			yield* this._value(item, span, innerIndent, oneLineMemoizer);
		}
		
		if (!collapseFirstLast && !this.deflate) {
			if (this.trailingComma) yield span(',', 'separator');
			yield span(currIndent, 'space');
		}
		yield span(']', 'brace');
	}
}

/**
 * A frozen Stringifier with all default options.
 */
Stringifier.DEFAULT = new Stringifier().freeze();


export class Span {
	constructor(text, type, lineNum, colNum) {
		this.text = text;
		this.type = type;
		this.line = lineNum;
		this.col = colNum;
	}
}

// 	_Parser: {
// 		/**
// 		 * Parse the textual representation of an NBT Tag.
// 		 * @param {string} value - The string to parse.
// 		 * @returns {TagBase} - The parsed Tag.
// 		 */
// 		parse: function(value) {
// 			this.string = value;
// 			this.cursor = 0;
			
// 			var compound = this.readCompound();
// 			this.skipWhitespace();
			
// 			if (this.canRead()) {
// 				++this.cursor;
// 				throw this.exception("Trailing data found");
// 			}
			
// 			return compound;
// 		},
// 		canRead: function() {
// 			return this.cursor < this.string.length;
// 		},
// 		whitespaceRE: /^\s*/,
// 		skipWhitespace: function() {
// 			this.cursor += this.string.substr(this.cursor).match(this.whitespaceRE)[0].length;
// 		},
// 		hasElementSeparator: function() {
// 			this.skipWhitespace();
// 			if (this.canRead() && this.peek() === ",") {
// 				++this.cursor;
// 				this.skipWhitespace();
// 				return true;
// 			}
// 			return false;
// 		},
// 		expect: function(expected) {
// 			this.skipWhitespace();
// 			var canRead = this.canRead();

// 			if (canRead && this.peek() === expected) {
// 				++this.cursor;
// 			} else {
// 				var message = "Expected '" + expected + "' but got '" +
// 					(canRead ? this.peek() : "<EOF>") + "'";
// 				++this.cursor;
// 				throw this.exception(message);
// 			}
// 		},
// 		peek: function(offset) {
// 			return this.string[this.cursor + (offset|0)];
// 		},
// 		pop: function() {
// 			return this.string[this.cursor++];
// 		},
// 		exception: function(message, suggestion) {
// 			var end = Math.min(this.string.length, this.cursor),
// 				exception;
// 			if (end > 35) {
// 				exception = "...";
// 			} else {
// 				exception = "";
// 			}
// 			exception += this.string.substring(Math.max(0, end - 35), end).replace(/\n/g, "\u21B5");
// 			exception += "<--[HERE]";
// 			exception = message + " at: " + exception;
// 			if (suggestion) return {error: "parsing_error", message: exception, suggestion: suggestion};
// 			return {error: "parsing_error", message: exception};
// 		},
// 		readCompound: function() {
// 			this.expect("{");
// 			var compound = new nbtlint.TagCompound();
// 			this.skipWhitespace();
			
// 			while (this.canRead() && this.peek() != "}") {
// 				this.skipWhitespace();
// 				var key;
// 				if (!this.canRead()) {
// 					throw this.exception("Expected a key");
// 				} else {
// 					var quote = this.peek();
// 					if (quote === '"' || quote === "'"){
// 						key = this.readQuotedString();
// 					} else {
// 						key = this.readUnquotedString();
// 					}
// 				}
// 				if (!key) throw this.exception("Expected non-empty key");
// 				if (key in compound.map) throw this.exception("Duplicate key");
				
// 				this.expect(":");
// 				compound.add(key, this.readValue());
				
// 				if (!this.hasElementSeparator()) break;
// 				if (!this.canRead()) throw this.exception("Expected a key");
// 			}
// 			this.expect("}");
// 			return compound;
// 		},
// 		readValue: function() {
// 			this.skipWhitespace();
// 			if (!this.canRead()) throw this.exception("Expected a value");
// 			var next = this.peek();
			
// 			switch (next) {
// 			case "{":
// 				return this.readCompound();
// 			case "[":
// 				return this.peek(1) !== '"' && this.peek(2) === ";" ?
// 					this.readArrayTag() : this.readListTag();
// 			case '"':
// 			case "'":
// 				return new nbtlint.TagString(this.readQuotedString(), false);
// 			}
// 			var s = this.readUnquotedString(), num;
// 			if (!s) throw this.exception("Expected a value");
// 			try {
// 				num = this.parseNumber(s);
// 			} catch (e) {
// 				s = new nbtlint.TagString(s, false);
// 				s.limitErr = e;
// 				return s;
// 			}
// 			return num || new nbtlint.TagString(s, false);
// 		},
// 		readArrayTag: function() {
// 			this.expect("[");
// 			var type = this.pop(), array;
// 			this.pop();
// 			this.skipWhitespace();
			
// 			if (!this.canRead()) throw this.exception("Expected a value");
// 			switch (type) {
// 			case "B":
// 				array = new nbtlint.TagArrayByte();
// 				break;
// 			case "L":
// 				array = new nbtlint.TagArrayLong();
// 				break;
// 			case "I":
// 				array = new nbtlint.TagArrayInt();
// 				break;
// 			default:
// 				throw this.exception("Invalid array type '" + type + "' found");
// 			}
			
// 			while (true) {
// 				if (this.peek() === "]") {
// 					++this.cursor;
// 					return array;
// 				}
				
// 				var currValue = this.readValue();
// 				if (currValue.constructor !== array.type) {
// 					throw this.exception("Unable to insert " + currValue.tagName +
// 						" into " + array.tagName);
// 				}
// 				array.push(currValue);
// 				if (this.hasElementSeparator()) {
// 					if (!this.canRead()) throw this.exception("Expected a value");
// 					continue;
// 				}
				
// 				this.expect("]");
// 				return array;
// 			}
// 		},
// 		readListTag: function() {
// 			this.expect("[");
// 			this.skipWhitespace();
			
// 			if (!this.canRead()) {
// 				throw this.exception("Expected a value");
// 			} else {
// 				var list = new nbtlint.TagList();
				
// 				while (this.peek() !== "]") {
// 					var val = this.readValue();
// 					try {	
// 						list.push(val);
// 					} catch (e) {
// 						throw this.exception("Unable to insert " + val.tagName +
// 							" into ListTag of type " + list.type.prototype.tagName);
// 					}
// 					if (!this.hasElementSeparator()) break;
// 					if (!this.canRead()) throw this.exception("Expected a value");
// 				}
				
// 				this.expect("]");
// 				return list;
// 			}
// 		},
// 		unquotedCharsRE: /^[a-zA-Z0-9._+\-]*/,
// 		readUnquotedString: function() {
// 			var string = this.string.substr(this.cursor).match(this.unquotedCharsRE)[0];
// 			this.cursor += string.length;
// 			return string;
// 		},
// 		readQuotedString: function() {
// 			var quote = this.pop(),
// 				startChunkIndex = this.cursor,
// 				string = "",
// 				inEscape = false;
// 			while (this.canRead()) {
// 				var c = this.pop();
// 				if (inEscape) {
// 					if (c !== "\\" && c !== quote) throw this.exception("Invalid escape of " + c);
// 					string += c;
// 					startChunkIndex = this.cursor;
// 					inEscape = false;
// 				} else if (c === "\\") {
// 					inEscape = true;
// 					string += this.string.substring(startChunkIndex, this.cursor - 1);
// 				} else if (c == quote) {
// 					return string + this.string.substring(startChunkIndex, this.cursor - 1);
// 				}
// 			}
// 			throw this.exception("Missing termination quote");
// 		},
// 		doubleNoSufRE: /^[-+]?(?:[0-9]+\.|[0-9]*\.[0-9]+)(?:e[-+]?[0-9]+)?$/i,
// 		doubleRE:      /^[-+]?(?:[0-9]+\.?|[0-9]*\.[0-9]+)(?:e[-+]?[0-9]+)?d$/i,
// 		floatRE:       /^[-+]?(?:[0-9]+\.?|[0-9]*\.[0-9]+)(?:e[-+]?[0-9]+)?f$/i,
// 		byteRE:        /^[-+]?(?:0|[1-9][0-9]*)b$/i,
// 		shortRE:       /^[-+]?(?:0|[1-9][0-9]*)s$/i,
// 		integerRE:     /^[-+]?(?:0|[1-9][0-9]*)$/,
// 		longRE:        /^([-+])?(?:0|[1-9][0-9]*)l$/i,
// 		parseNumber: function(s) {
// 			if (this.floatRE.test(s)) {
// 				return new nbtlint.TagFloat(+s.substr(0, s.length - 1));
// 			}
// 			if (this.byteRE.test(s)) {
// 				return new nbtlint.TagByte(+s.substring(0, s.length - 1), false);
// 			}
// 			if (this.longRE.test(s)) {
// 				// As a string
// 				return new nbtlint.TagLong(s.substring(0, s.length - 1));
// 			}
// 			if (this.shortRE.test(s)) {
// 				return new nbtlint.TagShort(+s.substring(0, s.length - 1));
// 			}
// 			if (this.integerRE.test(s)) {
// 				return new nbtlint.TagInteger(+s);
// 			}
// 			if (this.doubleRE.test(s)) {
// 				return new nbtlint.TagDouble(+s.substring(0, s.length - 1));
// 			}
// 			if (this.doubleNoSufRE.test(s)) {
// 				return new nbtlint.TagDouble(+s);
// 			}
// 			if (s.toLowerCase() === "true") {
// 				return new nbtlint.TagByte(1, true);
// 			}
// 			if (s.toLowerCase() === "false") {
// 				return new nbtlint.TagByte(0, true);
// 			}
// 		}
// 	},
// };

