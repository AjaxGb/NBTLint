var input  = document.getElementById("in"),
    output = document.getElementById("out"),
    spaces = document.getElementById("spaces"),
    indent = document.getElementById("indent"),
    sortKeys = document.getElementById("sortKeys"),
    parsedData;

function validateNBT() {
	parsedData = undefined;
	try {
		parsedData = NBT.parse(input.value);
	} catch (e) {
		console.log(e);
		output.value = e.error;
		if (e.suggestion) {
			output.value += "\n\n" + e.suggestion;
		}
		return;
	}
	updateOutput();
}
document.getElementById("go").onclick = validateNBT;

function updateOutput() {
	if (parsedData) {
		output.value = NBT.stringify(parsedData,
			(spaces.checked ? "        ".substr(0, +indent.value) : "\t"),
			{
				sortKeys: sortKeys.checked
			});
	}
}
spaces.onclick = sortKeys.onclick = updateOutput;

indent.oninput = function() {
	updateOutput();
	if (indent.value.length === 1 && indent.value >= "0" && indent.value <= "8") {
		document.body.className = "tab-" + indent.value;
	}
};

function getQueryArgs(query) {
	query = (query || window.location.search).substring(1);
	if (!query) return {};
	return query.split("&").reduce(function(prev, curr) {
		var p = curr.split("=");
		prev[decodeURIComponent(p[0])] = p[1] ? decodeURIComponent(p[1]) : p[1];
		return prev;
	}, {});
}

function setQueryArgs(query) {
	if (!query) return;
	let search = "";
	for (let prop in query){
		if (query[prop] === undefined) {
			search += "&" + encodeURIComponent(prop);
		} else {
			search += "&" + encodeURIComponent(prop) + "=" + encodeURIComponent(query[prop]);
		}
	}
	return "?" + search.substr(1);
}

document.getElementById("link").onclick = function() {
	window.location.search = setQueryArgs({
		input: input.value,
		ws: spaces.checked ? "spaces" : "tabs",
		indent: indent.value,
		sort: sortKeys.checked,
	});
};

function loadLink() {
	var args = getQueryArgs();
	input.value = args.input || "";
	spaces.checked = args.ws === "spaces";
	if ("indent" in args) indent.value = args.indent|0;
	sortKeys.checked = args.sort !== "false";
	if (input.value) {
		validateNBT();
	} else {
		output.value = "";
	}
}
loadLink();
