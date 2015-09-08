var subtitles = ["cube rubixer", "development ninja", "computer engineering student", "voodoo guitar specialist",  "retro gamer", "brainstormer extraordinare", "trekkie"]
var rnd;
var prev;
var subIntID;
var i;
var changeSubtitleInterval;
var threshold;

function writeChar() {
	var currentChar = subtitles[rnd].charAt(i);

	$('.homeWrapper .itemsWrapper .subtitle').append(currentChar);
	
	i++;
	if (i == subtitles[rnd].length)
	{
		clearInterval(subIntID);
	}
}

function changeSubtitle(callback) {
	$('.homeWrapper .itemsWrapper .subtitle').html("");
	
	while(prev == rnd)
		rnd = Math.floor(Math.random() * subtitles.length);
	
	prev = rnd
	
	i=0;
	
	subIntID = setInterval(writeChar, 40);	
}

// if subtitle isn't in viewport, don't change it
function scrolling_stopSubtitleChangeIfThreshold(subtitleThreshold) {
	threshold = subtitleThreshold;

	var scroll = $(window).scrollTop();

	if (scroll > threshold) {
		clearInterval(changeSubtitleInterval);
		changeSubtitleInterval = false;
	}
	else if (scroll < threshold  && !changeSubtitleInterval) {
		changeSubtitleInterval = setInterval(changeSubtitle, 2700);
	}


}

$(window).focusout(function() {
	clearInterval(changeSubtitleInterval);
	changeSubtitleInterval = false;
});

$(window).focusin(function() {
	if (scroll < threshold && !changeSubtitleInterval) {
		changeSubtitleInterval = setInterval(changeSubtitle, 2700);
	}
});
