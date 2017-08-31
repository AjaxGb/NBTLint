var input  = document.getElementById("in"),
    output = document.getElementById("out");

document.getElementById("go").onclick = function() {
	var nbt;
	try {
		nbt = NBT.parse(input.value);
	} catch (e) {
		console.log(e);
		output.value = e.error;
		if (e.suggestion) {
			output.value += "\n\n" + e.suggestion;
		}
		return;
	}
	output.value = NBT.stringify(nbt, "\t");
};