var input  = document.getElementById("in"),
    output = document.getElementById("out"),
    spaces = document.getElementById("spaces"),
    indent = document.getElementById("indent"),
    sortKeys = document.getElementById("sortKeys"),
    quoteKeys = document.getElementById("quoteKeys"),
    quoteStrings = document.getElementById("quoteStrings"),
    deflate = document.getElementById("deflate"),
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
				sortKeys: sortKeys.checked,
				quoteKeys: quoteKeys.checked,
				unquoteStrings: !quoteStrings.checked,
				deflate: deflate.checked,
			});
	}
}
spaces.onclick = sortKeys.onclick = quoteKeys.onclick = quoteStrings.onclick =
	deflate.onclick = updateOutput;

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
	var args = {
		input: input.value,
		ws: spaces.checked ? "spaces" : "tabs",
		indent: indent.value,
	};
	if (sortKeys.checked) args.sort = undefined;
	if (quoteKeys.checked) args.qKeys = undefined;
	if (!quoteStrings.checked) args.unqStr = undefined;
	if (deflate.checked) args.deflate = undefined;
	window.location.search = setQueryArgs(args);
};

function loadLink() {
	var args = getQueryArgs();
	input.value = args.input || "";
	spaces.checked = args.ws === "spaces";
	if ("indent" in args) indent.value = args.indent|0;
	sortKeys.checked = "sort" in args;
	quoteKeys.checked = "qKeys" in args;
	quoteStrings.checked = !("unqStr" in args);
	deflate.checked = "deflate" in args;
	if (input.value) {
		validateNBT();
	} else {
		output.value = "";
	}
}
loadLink();
