var input  = document.getElementById("in"),
    output = document.getElementById("out"),
    spaces = document.getElementById("spaces"),
    indent = document.getElementById("indent"),
    parsedData;

document.getElementById("go").onclick = function() {
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
};

function updateOutput() {
	if (parsedData) {
		output.value = NBT.stringify(parsedData, (spaces.checked ?
			"        ".substr(0, +indent.value) :
			"\t"));
	}
}

spaces.onclick = updateOutput;
indent.oninput = function() {
	updateOutput();
	document.body.className = "tab-" + indent.value;
};