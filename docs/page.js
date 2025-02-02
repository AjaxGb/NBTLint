"use strict";

var input  = document.getElementById("in"),
    output = document.getElementById("out"),
    settings = {
    	deflate        : document.getElementById("deflate"),
    	spaces         : document.getElementById("spaces"),
    	indent         : document.getElementById("indent"),
    	nlBracket      : document.getElementById("nlBracket"),
    	collapseBracket: document.getElementById("collapseBracket"),
    	collapsePrim   : document.getElementById("collapsePrim"),
		escapeNewlines : document.getElementById("escapeNewlines"),
		mixedLists     : document.getElementById("mixedLists"),
    	trailingComma  : document.getElementById("trailingComma"),
    	sortType       : document.getElementById("sortType"),
    	sortAlpha      : document.getElementById("sortAlpha"),
    	quoteKeys      : document.getElementById("quoteKeys"),
    	quoteStrings   : document.getElementById("quoteStrings"),
    	quoteChoice    : document.getElementById("quoteChoice"),
    	boolChoice     : document.getElementById("boolChoice"),
    	capitalL       : document.getElementById("capitalL"),
    	capitalSuff    : document.getElementById("capitalSuff"),
    },
    parsedData,
	parseError,
    notes = [];

settings.mixedLists.affectsParse = true;

function updateSetting(item) {
	item = item instanceof Event ? this : item || this;
	if (item.affectsParse) {
		if (parsedData || parseError) {
			validateNBT();
		}
	} else {
		updateOutput();
	}
	localStorage.setItem(item.id, item.type === "checkbox" ? item.checked : item.value);
}

for (var name in settings) {
	var el = settings[name];
	el[el.type === "checkbox" ? "onclick" : "oninput"] = updateSetting;
}
indent.oninput = function() {
	updateSetting(this);
	var val = settings.indent.value;
	if (val.length === 1 && val >= "0" && val <= "8") {
		document.body.className = "tab-" + val;
	}
};

function loadSettings() {
	for (var name in settings) {
		var el = settings[name], val = localStorage.getItem(el.id);

		if (val !== null) {
			if (el.type === "checkbox") {
				el.checked = (val !== "false");
				el.onclick();
			} else {
				el.value = val;
				el.oninput();
			}
		}
	}
}
loadSettings();

function getNoteString() {
	if (notes.length === 0) {
		return "";
	} else {
		return notes.join("\n") + "\n\n";
	}
}

function validateNBT() {
	parsedData = parseError = undefined;
	notes = [];
	try {
		parsedData = nbtlint.parse(input.value, {
			mixedLists: settings.mixedLists.checked,
		});
	} catch (e) {
		console.log(e);
		parseError = e;
	}
	updateOutput();
}
document.getElementById("go").onclick = function() {
	location.hash = "#" + input.value.replace(/[%\r\n\0]/g, function(m) {
		var esc = m.charCodeAt(0).toString(16);
		if (esc.length < 2) esc = "0" + esc;
		return "%" + esc;
	});
	validateNBT();
};

function updateOutput() {
	output.value = getNoteString();
	if (parseError) {
		output.value += parseError.message;
		if (parseError.suggestion) {
			output.value += "\n\n" + parseError.suggestion;
		}
	} else if (parsedData) {
		var sort = false;
		if (settings.sortAlpha.checked && settings.sortType.checked) {
			sort = nbtlint.compareTypeAlpha;
		} else if (settings.sortType.checked) {
			sort = nbtlint.compareType;
		} else if (settings.sortAlpha.checked) {
			sort = nbtlint.compareAlpha;
		}
		output.value += nbtlint.stringify(parsedData,
			(settings.spaces.checked
				? "        ".substring(0, +settings.indent.value)
				: "\t"),
			{
				nlBrackets      : settings.nlBracket.checked,
				collapseBrackets: settings.collapseBracket.checked,
				expandPrimitives: !settings.collapsePrim.checked,
				escapeNewlines  : settings.escapeNewlines.checked,
				trailingComma   : settings.trailingComma.checked,
				sort            : sort,
				quoteKeys       : settings.quoteKeys.checked,
				unquoteStrings  : !settings.quoteStrings.checked,
				quoteChoice     : settings.quoteChoice.value,
				boolChoice      : settings.boolChoice.value,
				deflate         : settings.deflate.checked,
				capitalizeSuffix: {
					l: settings.capitalL.checked,
					default: settings.capitalSuff.checked,
				},
			});
	}
}

function loadLink() {
	var linkInput = decodeURIComponent(location.hash.substr(1));

	if (linkInput === input.value) {
		return;
	} else {
		input.value = linkInput;
	}

	if (input.value) {
		validateNBT();
	} else {
		output.value = "";
	}
}
window.onhashchange = document.onhashchange = loadLink;
loadLink();
