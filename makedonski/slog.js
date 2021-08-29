function IsVowel(letter)
{
	var vowels = ["а","е","и","о","у"]
	for (var i = 0; i < vowels.length; i++) 
	{
		if(letter === vowels[i]) return true;
	}
	
	return false;
}

function SplitWord(word)
{
	var retVal = new Array();
	var result = "";
	for (var i = 0; i < word.length; i++) 
	{
		var isVowel = IsVowel(word[i]);
		var nextTwoAreConsonants =  !IsVowel(word[i+1]) && !IsVowel(word[i+2]);
		var leftWith = word.substr(i, word.length-i);
		
		if(!(leftWith === "ски" || leftWith === "ство" || leftWith === "ствен"))
		{
			result += word[i];
			if(i != word.length-2 && i != 0 && isVowel && !nextTwoAreConsonants)
			{
				retVal.push(result);
				result = "";
			}
			else if(i != 0 && i != word.length-2 && !isVowel && !IsVowel(word[i+1]) && IsVowel(word[i-1]))
			{
				retVal.push(result);
				result = "";
			}
		}
		else
		{
			retVal.push(result);
			result = word[i];
		}
	}
	
	retVal.push(result);
	
	return retVal;
}