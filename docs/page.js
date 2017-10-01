"use strict";

var input  = document.getElementById("in"),
    output = document.getElementById("out"),
    settings = {
    	deflate     : document.getElementById("deflate"),
	    spaces      : document.getElementById("spaces"),
	    indent      : document.getElementById("indent"),
	    sortType    : document.getElementById("sortType"),
	    sortAlpha   : document.getElementById("sortAlpha"),
	    quoteKeys   : document.getElementById("quoteKeys"),
	    quoteStrings: document.getElementById("quoteStrings"),
	    capitalL    : document.getElementById("capitalL"),
	    capitalSuff : document.getElementById("capitalSuff"),
    },
    parsedData;

function updateSetting(item) {
	updateOutput();
	item = item instanceof Event ? this : item || this;
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

function validateNBT() {
	parsedData = undefined;
	try {
		parsedData = nbtlint.parse(input.value);
	} catch (e) {
		console.log(e);
		output.value = e.message;
		if (e.suggestion) {
			output.value += "\n\n" + e.suggestion;
		}
		return;
	}
	updateOutput();
}
document.getElementById("go").onclick = function() {
	location.hash = "#" + input.value.replace(/[%\n\0]/g, function(m) {
		var esc = m.charCodeAt(0).toString(16);
		if (esc.length < 2) esc = "0" + esc;
		return "%" + esc;
	});
	validateNBT();
};

function updateOutput() {
	if (parsedData) {
		var sort = false;
		if (settings.sortAlpha.checked && settings.sortType.checked) {
			sort = nbtlint.compareTypeAlpha;
		} else if (settings.sortType.checked) {
			sort = nbtlint.compareType;
		} else if (settings.sortAlpha.checked) {
			sort = nbtlint.compareAlpha;
		}
		output.value = nbtlint.stringify(parsedData,
			(settings.spaces.checked ? "        ".substr(0, +settings.indent.value) : "\t"),
			{
				sort: sort,
				quoteKeys: settings.quoteKeys.checked,
				unquoteStrings: !settings.quoteStrings.checked,
				deflate: settings.deflate.checked,
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
